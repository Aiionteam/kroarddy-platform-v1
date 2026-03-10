package site.aiion.api.gateway.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web MVC 설정
 * - CORS는 Nginx에서 처리 (중복 헤더 방지)
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {
    // CORS 설정은 Nginx에서 처리하므로 여기서는 설정하지 않음
    // Nginx가 Access-Control-Allow-Origin 헤더를 추가함
}

