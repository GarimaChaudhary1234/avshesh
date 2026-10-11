package com.avshesh.scan;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;

/** Credentials come from the standard AWS chain (env vars, ~/.aws, or an IAM role on AWS). */
@Configuration
@ConditionalOnProperty(name = "avshesh.scanner", havingValue = "bedrock")
public class BedrockConfig {

    @Bean
    BedrockRuntimeClient bedrockRuntimeClient(@Value("${avshesh.aws.region}") String region) {
        return BedrockRuntimeClient.builder().region(Region.of(region)).build();
    }
}
