package com.avshesh.sms;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sns.SnsClient;

@Configuration
@ConditionalOnProperty(name = "avshesh.sms.sender", havingValue = "sns")
public class SnsConfig {

    @Bean
    SnsClient snsClient(@Value("${avshesh.aws.region}") String region) {
        return SnsClient.builder().region(Region.of(region)).build();
    }
}
