package site.aiion.api.services.user.common.domain;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "응답 메시지")
public class Messenger {
    @Schema(description = "응답 코드", example = "200")
    private int code;
    
    @Schema(description = "응답 메시지", example = "어서옵쇼")
    private String message;
    
    @Schema(description = "응답 데이터")
    private Object data;
}

