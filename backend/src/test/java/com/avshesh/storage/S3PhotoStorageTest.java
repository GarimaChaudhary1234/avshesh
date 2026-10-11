package com.avshesh.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Object;

/** Against a fake client: proves the key layout and the order of calls, not the behaviour of real S3. */
class S3PhotoStorageTest {

    private final S3Client s3 = mock(S3Client.class);
    private final S3PhotoStorage storage = new S3PhotoStorage(s3, "bucket");

    @Test
    void scanPhotosGoToTheTempPrefix() {
        String key = storage.saveTemp(new byte[] {1, 2}, "image/png");

        ArgumentCaptor<PutObjectRequest> put = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3).putObject(put.capture(), any(RequestBody.class));
        assertEquals("bucket", put.getValue().bucket());
        assertEquals("tmp/" + key, put.getValue().key());
        assertTrue(key.endsWith(".png"));
    }

    @Test
    void keepCopiesToKeptThenDeletesTheTempObject() {
        String key = "123e4567-e89b-12d3-a456-426614174000.jpg";
        assertTrue(storage.keep(key));

        ArgumentCaptor<CopyObjectRequest> copy = ArgumentCaptor.forClass(CopyObjectRequest.class);
        verify(s3).copyObject(copy.capture());
        assertEquals("tmp/" + key, copy.getValue().sourceKey());
        assertEquals("kept/" + key, copy.getValue().destinationKey());
        ArgumentCaptor<DeleteObjectRequest> delete = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3).deleteObject(delete.capture());
        assertEquals("tmp/" + key, delete.getValue().key());
    }

    @Test
    void keepingAnAlreadyKeptPhotoIsFine() {
        String key = "123e4567-e89b-12d3-a456-426614174000.jpg";
        when(s3.copyObject(any(CopyObjectRequest.class))).thenThrow(NoSuchKeyException.builder().build());

        assertTrue(storage.keep(key));
        verify(s3).headObject(any(HeadObjectRequest.class));
    }

    @Test
    void keepingAPhotoThatExistsNowhereIsRefused() {
        String key = "123e4567-e89b-12d3-a456-426614174000.jpg";
        when(s3.copyObject(any(CopyObjectRequest.class))).thenThrow(NoSuchKeyException.builder().build());
        when(s3.headObject(any(HeadObjectRequest.class))).thenThrow(NoSuchKeyException.builder().build());

        assertFalse(storage.keep(key));
    }

    @Test
    void dangerousKeysNeverReachS3() {
        assertFalse(storage.keep("../secret.jpg"));
        assertFalse(storage.keep(null));
        verify(s3, never()).copyObject(any(CopyObjectRequest.class));
    }

    @Test
    void cleanupDeletesOnlyOldTempObjectsAcrossPages() {
        Instant old = Instant.now().minus(Duration.ofHours(30));
        Instant fresh = Instant.now().minus(Duration.ofHours(1));
        when(s3.listObjectsV2(any(ListObjectsV2Request.class))).thenReturn(
                ListObjectsV2Response.builder().isTruncated(true).nextContinuationToken("next")
                        .contents(List.of(S3Object.builder().key("tmp/a.jpg").lastModified(old).build(),
                                S3Object.builder().key("tmp/b.jpg").lastModified(fresh).build())).build(),
                ListObjectsV2Response.builder().isTruncated(false)
                        .contents(List.of(S3Object.builder().key("tmp/c.jpg").lastModified(old).build())).build());

        assertEquals(2, storage.deleteTempOlderThan(Duration.ofHours(24)));
        ArgumentCaptor<DeleteObjectRequest> delete = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3, org.mockito.Mockito.times(2)).deleteObject(delete.capture());
        assertEquals(List.of("tmp/a.jpg", "tmp/c.jpg"), delete.getAllValues().stream().map(DeleteObjectRequest::key).toList());
    }
}
