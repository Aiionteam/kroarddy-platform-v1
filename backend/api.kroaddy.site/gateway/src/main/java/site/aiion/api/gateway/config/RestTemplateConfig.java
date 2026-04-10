package site.aiion.api.gateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * RestTemplate – Apache HttpComponents 기반
 *
 * Spring Boot 3.5.x 에서 RestTemplateBuilder.requestFactory() 가 내부 리플렉션 방식을
 * 변경하면서 HttpComponentsClientHttpRequestFactory 와 충돌하므로,
 * RestTemplate 을 직접 생성한다.
 *
 * HttpComponentsClientHttpRequestFactory 는 DELETE·PATCH 를 포함한 모든 HTTP 메서드를 지원한다.
 */
@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate() {
        HttpComponentsClientHttpRequestFactory factory =
                new HttpComponentsClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(15));
        factory.setConnectionRequestTimeout(Duration.ofSeconds(15));
        factory.setReadTimeout(Duration.ofSeconds(900)); // 15분 – 긴 AI/프록시 응답과 게이트움이 정렬

        return new RestTemplate(factory);
    }
}

