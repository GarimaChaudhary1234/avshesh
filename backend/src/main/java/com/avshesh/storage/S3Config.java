package com.avshesh.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import software.amazon.awssdk.services.s3.S3Client;

@Configuration
@Profile("aws")
class S3Config {

    @Bean
    S3Client s3Client(@Value("${avshesh.aws.region}") String region) {
        return S3PhotoStorage.client(region);
    }
}
