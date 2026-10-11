package com.avshesh.municipal;

import java.util.List;

import org.springframework.stereotype.Service;

import com.avshesh.municipal.PaymentDisputes.Dispute;

/** Payment disputes raised by households, limited to the officer's ward. */
@Service
public class MunicipalDisputeService {

    private final PaymentDisputes disputes;
    private final MunicipalScope scope;

    public MunicipalDisputeService(PaymentDisputes disputes, MunicipalScope scope) {
        this.disputes = disputes;
        this.scope = scope;
    }

    public List<Dispute> list(long officerId) {
        Long ward = scope.wardOf(officerId);
        return disputes.recent().stream().filter(d -> ward == null || ward.equals(d.wardId())).toList();
    }

    /** Open disputes per ward id. */
    public java.util.Map<Long, Long> openByWard() {
        return disputes.recent().stream().filter(d -> "DISPUTED".equals(d.status()) && d.wardId() != null)
                .collect(java.util.stream.Collectors.groupingBy(Dispute::wardId, java.util.stream.Collectors.counting()));
    }

    public long countOpen(Long ward) {
        return disputes.recent().stream()
                .filter(d -> "DISPUTED".equals(d.status()) && (ward == null || ward.equals(d.wardId()))).count();
    }

    public Dispute resolve(long officerId, long stopId, String note) {
        Dispute d = disputes.get(stopId);
        scope.requireAccess(scope.wardOf(officerId), d.wardId());
        return disputes.resolve(stopId, note.strip());
    }
}
