package com.avshesh.storage;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Object;

/**
 * Photos in an S3 bucket: scans go to {@code tmp/}, a photo used by a listing is copied to {@code kept/}. Credentials
 * come from the IAM role of the service, never from keys in the app. The hourly cleanup deletes old {@code tmp/}
 * objects; a bucket lifecycle rule that expires {@code tmp/} after one day (see infra/aws) is a second safety net.
 *
 * <p>Written from the AWS SDK documentation and unit-tested against a fake client only: it has not been run
 * against a real bucket.
 */
@Component
@Profile("aws")
public class S3PhotoStorage implements PhotoStorage {

    static final String TEMP = "tmp/";
    static final String KEPT = "kept/";

    private final S3Client s3;
    private final String bucket;

    public S3PhotoStorage(S3Client s3, @Value("${avshesh.s3.bucket}") String bucket) {
        this.s3 = s3;
        this.bucket = bucket;
    }

    /** Creates the client for the configured region (credentials from the default provider chain / task role). */
    public static S3Client client(String region) {
        return S3Client.builder().region(Region.of(region)).build();
    }

    @Override
    public String saveTemp(byte[] image, String contentType) {
        String key = UUID.randomUUID() + extensionOf(contentType);
        s3.putObject(PutObjectRequest.builder().bucket(bucket).key(TEMP + key)
                .contentType(contentType == null ? "image/jpeg" : contentType).build(), RequestBody.fromBytes(image));
        return key;
    }

    @Override
    public boolean keep(String key) {
        if (key == null || !KEY.matcher(key).matches()) {
            return false;
        }
        try {
            s3.copyObject(CopyObjectRequest.builder().sourceBucket(bucket).sourceKey(TEMP + key)
                    .destinationBucket(bucket).destinationKey(KEPT + key).build());
        } catch (NoSuchKeyException missing) {
            // Already kept earlier (a retry), or it never existed.
            return exists(KEPT + key);
        }
        s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(TEMP + key).build());
        return true;
    }

    @Override
    public int deleteTempOlderThan(Duration age) {
        Instant cutoff = Instant.now().minus(age);
        int deleted = 0;
        String token = null;
        do {
            ListObjectsV2Response page = s3.listObjectsV2(ListObjectsV2Request.builder().bucket(bucket)
                    .prefix(TEMP).continuationToken(token).build());
            for (S3Object object : page.contents()) {
                if (object.lastModified().isBefore(cutoff)) {
                    s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(object.key()).build());
                    deleted++;
                }
            }
            token = Boolean.TRUE.equals(page.isTruncated()) ? page.nextContinuationToken() : null;
        } while (token != null);
        return deleted;
    }

    private boolean exists(String objectKey) {
        try {
            s3.headObject(HeadObjectRequest.builder().bucket(bucket).key(objectKey).build());
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        }
    }

    private static String extensionOf(String contentType) {
        return switch (contentType == null ? "" : contentType) {
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            default -> ".jpg";
        };
    }
}
