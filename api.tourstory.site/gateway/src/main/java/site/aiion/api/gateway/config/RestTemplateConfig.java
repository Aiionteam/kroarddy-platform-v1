package site.aiion.api.gateway.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * RestTemplate – Apache HttpComponents 기반
 *
 * SimpleClientHttpRequestFactory(Java HttpURLConnection)는 PATCH HTTP 메서드를 지원하지 않는다.
 * HttpComponentsClientHttpRequestFactory는 DELETE·PATCH 포함 모든 HTTP 메서드를 지원한다.
 */
@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        HttpComponentsClientHttpRequestFactory factory =
                new HttpComponentsClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(15));
        factory.setConnectionRequestTimeout(Duration.ofSeconds(15));

        return builder
                .requestFactory(() -> factory)
                .readTimeout(Duration.ofSeconds(300)) // 5분 – AI 응답 대기
                .build();
    }
}

