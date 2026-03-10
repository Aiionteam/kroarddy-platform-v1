package site.aiion.api.gateway;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
public class RootController {

    @Value("${spring.application.name:API Gateway}")
    private String applicationName;

    @GetMapping("/")
    public Map<String, Object> root() {
        Map<String, Object> response = new HashMap<>();
        response.put("service", applicationName);
        response.put("version", "v1");
        response.put("status", "running");
        response.put("timestamp", LocalDateTime.now().toString());
        
        Map<String, String> endpoints = new HashMap<>();
        endpoints.put("documentation", "/docs");
        endpoints.put("api-docs", "/v3/api-docs");
        endpoints.put("health", "/actuator/health");
        endpoints.put("user-api", "/api/users");
        endpoints.put("friends-api", "/api/friends");
        endpoints.put("diary-api", "/api/diaries");
        endpoints.put("oauth-api", "/api/oauth");
        
        response.put("endpoints", endpoints);
        
        return response;
    }
}

