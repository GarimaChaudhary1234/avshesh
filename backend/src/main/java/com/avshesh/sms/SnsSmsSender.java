package com.avshesh.sms;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.avshesh.common.ApiException;

import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.MessageAttributeValue;
import software.amazon.awssdk.services.sns.model.PublishRequest;

/**
 * Sends real SMS through Amazon SNS ({@code avshesh.sms=sns}). Credentials come from the usual AWS chain, so on
 * AWS an IAM role with {@code sns:Publish} is enough. A new AWS account starts in the SNS SMS sandbox: only
 * verified destination numbers receive messages until the account is moved out of it.
 */
@Component
@ConditionalOnProperty(name = "avshesh.sms.sender", havingValue = "sns")
public class SnsSmsSender implements SmsSender {

    private static final Logger log = LoggerFactory.getLogger(SnsSmsSender.class);

    private final SnsClient sns;
    private final String countryCode;

    public SnsSmsSender(SnsClient sns, @Value("${avshesh.sms.country-code:+91}") String countryCode) {
        this.sns = sns;
        this.countryCode = countryCode;
    }

    @Override
    public void send(String phone, String text) {
        try {
            sns.publish(PublishRequest.builder()
                    .phoneNumber(countryCode + phone)
                    .message(text)
                    .messageAttributes(Map.of("AWS.SNS.SMS.SMSType",
                            MessageAttributeValue.builder().dataType("String").stringValue("Transactional").build()))
                    .build());
        } catch (SdkException e) {
            log.warn("SNS could not send an SMS: {}", e.getMessage());
            throw ApiException.badGateway("SMS_UNAVAILABLE", "The SMS service is unavailable right now. Please try again in a moment.");
        }
    }
}
