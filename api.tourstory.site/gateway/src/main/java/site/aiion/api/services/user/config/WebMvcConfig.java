package site.aiion.api.services.user.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.config.annotation.ContentNegotiationConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Override
    public void configureContentNegotiation(ContentNegotiationConfigurer configurer) {
        // UTF-8을 명시적으로 설정한 MediaType 사용
        MediaType utf8Json = new MediaType(MediaType.APPLICATION_JSON, java.nio.charset.StandardCharsets.UTF_8);
        configurer
            .defaultContentType(utf8Json)
            .mediaType("json", utf8Json);
    }
}
