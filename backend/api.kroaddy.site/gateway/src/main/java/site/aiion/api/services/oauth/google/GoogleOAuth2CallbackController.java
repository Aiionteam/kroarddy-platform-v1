package site.aiion.api.services.oauth.google;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.view.RedirectView;

/**
 * Google OAuth2 표준 콜백 경로 처리
 * Google Cloud Console에 등록된 redirect URI: /oauth2/google/callback
 * 실제 처리는 GoogleController의 googleCallback 메서드를 재사용
 */
@RestController
@RequestMapping("/oauth2")
public class GoogleOAuth2CallbackController {
    
    private final GoogleController googleController;
    
    public GoogleOAuth2CallbackController(GoogleController googleController) {
        this.googleController = googleController;
    }
    
    /**
     * Google OAuth2 표준 콜백 경로
     * /oauth2/google/callback -> GoogleController.googleCallback()로 위임
     */
    @GetMapping("/google/callback")
    public RedirectView googleCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @RequestParam(required = false) String error_description,
            jakarta.servlet.http.HttpServletResponse response) {
        // GoogleController의 googleCallback 메서드 호출
        return googleController.googleCallback(code, state, error, error_description, response);
    }
}

