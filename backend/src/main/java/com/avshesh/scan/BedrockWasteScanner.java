package com.avshesh.scan;

import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.avshesh.common.ApiException;

import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.ContentBlock;
import software.amazon.awssdk.services.bedrockruntime.model.ConversationRole;
import software.amazon.awssdk.services.bedrockruntime.model.ConverseRequest;
import software.amazon.awssdk.services.bedrockruntime.model.ConverseResponse;
import software.amazon.awssdk.services.bedrockruntime.model.ImageBlock;
import software.amazon.awssdk.services.bedrockruntime.model.ImageFormat;
import software.amazon.awssdk.services.bedrockruntime.model.ImageSource;
import software.amazon.awssdk.services.bedrockruntime.model.InferenceConfiguration;
import software.amazon.awssdk.services.bedrockruntime.model.Message;

/**
 * Sends the photo to a multimodal model on Amazon Bedrock (Converse API) and maps its answer back to
 * one of the catalog codes. The model may only answer with a code from the catalog, so a result always
 * has a known category and price range.
 */
@Component
@ConditionalOnProperty(name = "avshesh.scanner", havingValue = "bedrock")
public class BedrockWasteScanner implements WasteScanner {

    private static final Logger log = LoggerFactory.getLogger(BedrockWasteScanner.class);

    /** Bedrock rejects images larger than this. */
    private static final int MAX_IMAGE_BYTES = 3_700_000;
    private static final double MIN_CONFIDENCE = 0.4;

    private static final Map<String, ImageFormat> FORMATS = Map.of(
            "image/jpeg", ImageFormat.JPEG,
            "image/png", ImageFormat.PNG,
            "image/webp", ImageFormat.WEBP,
            "image/gif", ImageFormat.GIF);

    private final BedrockRuntimeClient client;
    private final ItemCatalog catalog;
    private final String modelId;

    public BedrockWasteScanner(BedrockRuntimeClient client, ItemCatalog catalog,
                               @Value("${avshesh.bedrock.model-id}") String modelId) {
        this.client = client;
        this.catalog = catalog;
        this.modelId = modelId;
    }

    @Override
    public Detection detect(byte[] image, String contentType, String hint) {
        ImageFormat format = FORMATS.get(contentType == null ? "" : contentType.toLowerCase(Locale.ROOT));
        if (format == null) {
            throw ApiException.badRequest("SCAN_BAD_FORMAT", "Please upload a JPEG, PNG, WEBP or GIF photo");
        }
        if (image.length > MAX_IMAGE_BYTES) {
            throw ApiException.badRequest("SCAN_TOO_LARGE", "The photo is too large for the AI. Please use one under 3.5 MB");
        }

        String answer = ask(image, format);
        return parse(answer);
    }

    private String ask(byte[] image, ImageFormat format) {
        Message message = Message.builder()
                .role(ConversationRole.USER)
                .content(
                        ContentBlock.fromImage(ImageBlock.builder()
                                .format(format)
                                .source(ImageSource.fromBytes(SdkBytes.fromByteArray(image)))
                                .build()),
                        ContentBlock.fromText(prompt()))
                .build();
        try {
            ConverseResponse response = client.converse(ConverseRequest.builder()
                    .modelId(modelId)
                    .messages(message)
                    .inferenceConfig(InferenceConfiguration.builder().maxTokens(30).temperature(0f).build())
                    .build());
            return response.output().message().content().get(0).text();
        } catch (SdkException e) {
            log.warn("Bedrock call failed: {}", e.getMessage());
            throw ApiException.badGateway("SCAN_AI_DOWN", "The AI service is unavailable right now. Please try again in a moment.");
        }
    }

    private String prompt() {
        String items = catalog.all().stream()
                .map(i -> i.code() + " = " + i.name())
                .collect(Collectors.joining("\n"));
        return """
                You sort household waste for a recycling marketplace in India.
                Look at the main item in the photo and choose the single best match from this list:
                %s

                Reply with exactly one line in the format CODE|CONFIDENCE, where CODE is one of the codes above,
                or UNKNOWN if the item is not on the list or the photo is unclear, and CONFIDENCE is a number
                between 0 and 1. Do not write anything else."""
                .formatted(items);
    }

    /** Package-private for tests. Anything that is not a clear catalog code is treated as "unknown". */
    Detection parse(String answer) {
        String line = answer == null ? "" : answer.strip().lines().findFirst().orElse("");
        String[] parts = line.split("\\|");
        String code = parts[0].strip().toUpperCase(Locale.ROOT);
        double confidence = 0;
        if (parts.length > 1) {
            try {
                confidence = Double.parseDouble(parts[1].strip());
            } catch (NumberFormatException ignored) {
                // keep 0: treated as low confidence below
            }
        }
        boolean known = catalog.find(code).isPresent();
        if (!known || confidence < MIN_CONFIDENCE) {
            log.info("Bedrock answer not usable: '{}'", line);
            throw ApiException.badRequest("SCAN_UNIDENTIFIED",
                    "Could not identify this item. Try a clearer photo of a single item.");
        }
        return new Detection(code, Math.min(confidence, 1.0));
    }

    @Override
    public String mode() {
        return "bedrock";
    }
}
