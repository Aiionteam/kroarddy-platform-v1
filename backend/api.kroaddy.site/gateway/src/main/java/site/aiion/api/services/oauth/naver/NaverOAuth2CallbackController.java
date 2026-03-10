package site.aiion.api.services.oauth.naver;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.view.RedirectView;

/**
 * Naver OAuth2 표준 콜백 경로 처리
 * Naver Developers에 등록된 redirect URI: /oauth2/naver/callback
 * 실제 처리는 NaverController의 naverCallback 메서드를 재사용
 */
@RestController
@RequestMapping("/oauth2")
public class NaverOAuth2CallbackController {
    
    private final NaverController naverController;
    
    public NaverOAuth2CallbackController(NaverController naverController) {
        this.naverController = naverController;
    }
    
    /**
     * Naver OAuth2 표준 콜백 경로
     * /oauth2/naver/callback -> NaverController.naverCallback()로 위임
     */
    @GetMapping("/naver/callback")
    public RedirectView naverCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @RequestParam(required = false) String error_description,
            jakarta.servlet.http.HttpServletResponse response) {
        return naverController.naverCallback(code, state, error, error_description, response);
    }
}

