package br.com.pocarsport.api.web;

import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import br.com.pocarsport.api.loja.RegraException;

/** Respostas de erro sempre no formato {"erro": "mensagem para o usuário"}. */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(RegraException.class)
    ResponseEntity<Map<String, Object>> regra(RegraException e) {
        return erro(HttpStatus.UNPROCESSABLE_ENTITY, e.getMessage());
    }

    /** Duas operações disputando o mesmo registro (dois caixas abertos, mesmo telefone, estoque já vendido). */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<Map<String, Object>> integridade(DataIntegrityViolationException e) {
        log.warn("Operação recusada pelo banco: {}", e.getMostSpecificCause().getMessage());
        return erro(HttpStatus.CONFLICT, "Os dados mudaram enquanto você fazia esta operação. Atualize a tela e tente de novo.");
    }

    @ExceptionHandler(AcessoNegadoException.class)
    ResponseEntity<Map<String, Object>> acessoNegado(AcessoNegadoException e) {
        return erro(HttpStatus.FORBIDDEN, e.getMessage());
    }

    @ExceptionHandler(NaoAutenticadoException.class)
    ResponseEntity<Map<String, Object>> naoAutenticado(NaoAutenticadoException e) {
        return erro(HttpStatus.UNAUTHORIZED, e.getMessage());
    }

    @ExceptionHandler(SenhaConfirmacaoException.class)
    ResponseEntity<Map<String, Object>> senha(SenhaConfirmacaoException e) {
        return erro(HttpStatus.FORBIDDEN, e.getMessage());
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    ResponseEntity<Map<String, Object>> requisicaoInvalida(Exception e) {
        return erro(HttpStatus.BAD_REQUEST, "Requisição inválida.");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, Object>> inesperado(Exception e) {
        log.error("Erro inesperado", e);
        return erro(HttpStatus.INTERNAL_SERVER_ERROR, "Erro inesperado no servidor. Tente de novo em instantes.");
    }

    private static ResponseEntity<Map<String, Object>> erro(HttpStatus status, String mensagem) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("erro", mensagem);
        return ResponseEntity.status(status).body(corpo);
    }
}
