package br.com.pocarsport.api.auditoria;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import br.com.pocarsport.api.auth.Usuario;

@Service
public class AuditoriaService {

    private static final int MAX_DETALHE = 2000;
    private static final int MAX_ACAO = 120;

    private final AuditoriaRepository repo;
    private final ZoneId zona;

    public AuditoriaService(AuditoriaRepository repo, @Value("${app.zona}") String zona) {
        this.repo = repo;
        this.zona = ZoneId.of(zona);
    }

    public void registrar(Usuario usuario, String acao, String detalhe, Long versao) {
        repo.inserir(usuario.login(), usuario.nome(), cortar(acao, MAX_ACAO), cortar(detalhe == null ? "" : detalhe, MAX_DETALHE), versao);
    }


    public List<RegistroAuditoria> buscar(String usuario, String periodo, String busca, Long antesDeId, int limite) {
        return repo.buscar(usuario, inicioDoPeriodo(periodo), busca, antesDeId, limite);
    }

    public List<String> usuarios() {
        return repo.usuarios();
    }

    OffsetDateTime inicioDoPeriodo(String periodo) {
        LocalDate hoje = LocalDate.now(zona);
        LocalDate inicio = switch (periodo == null ? "7d" : periodo) {
            case "hoje" -> hoje;
            case "30d" -> hoje.minusDays(29);
            case "tudo" -> null;
            default -> hoje.minusDays(6);
        };
        return inicio == null ? null : inicio.atStartOfDay(zona).toOffsetDateTime();
    }

    private static String cortar(String texto, int max) {
        return texto.length() <= max ? texto : texto.substring(0, max);
    }
}
