package site.aiion.api.gateway.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@OpenAPIDefinition(
        info = @Info(
                title = "Hohyun Platform API Gateway",
                description = "통합 API Gateway - OAuth, User, Diary 서비스",
                version = "v1"
        ),
        tags = {
                @Tag(name = "OAuth", description = "OAuth 인증 서비스 (Google, Naver, Kakao)"),
                @Tag(name = "User", description = "사용자 관리 서비스"),
                @Tag(name = "Diary", description = "일기 관리 서비스")
        }
)
@Configuration
public class SwaggerConfig {

    private static final String BEARER_TOKEN_PREFIX = "bearer";

    @Bean
    public OpenAPI openAPI() {
        String securityJwtName = "JWT";
        SecurityRequirement securityRequirement = new SecurityRequirement().addList(securityJwtName);
        Components components = new Components()
                .addSecuritySchemes(securityJwtName, new SecurityScheme()
                        .name(securityJwtName)
                        .type(SecurityScheme.Type.HTTP)
                        .scheme(BEARER_TOKEN_PREFIX)
                        .bearerFormat("JWT"));

        return new OpenAPI()
                .addSecurityItem(securityRequirement)
                .components(components);
    }
}

