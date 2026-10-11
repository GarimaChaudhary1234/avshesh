package com.avshesh.municipal;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.avshesh.user.UserAccount;
import com.avshesh.user.UserDirectory;

/** The record of what officers did, written next to each action and read by the commissioner (and by the ward's own officers). */
@Service
public class ActivityLog {

    public record Entry(Long id, Long actorId, String actorName, Long wardId, String code, String detail,
                        LocalDateTime at) {
    }

    private final MunicipalActivityRepository activity;
    private final UserDirectory users;

    public ActivityLog(MunicipalActivityRepository activity, UserDirectory users) {
        this.activity = activity;
        this.users = users;
    }

    /** @param wardId the ward the action was about, or null for an action on the whole city */
    @Transactional
    public void record(long actorId, Long wardId, String code, String detail) {
        MunicipalActivity a = new MunicipalActivity();
        a.setActorId(actorId);
        a.setWardId(wardId);
        a.setCode(code);
        a.setDetail(detail == null ? null : detail.length() > 200 ? detail.substring(0, 200) : detail);
        activity.save(a);
    }

    /** The newest 50 actions of one ward, or of the whole city when {@code wardId} is null. */
    @Transactional(readOnly = true)
    public List<Entry> recent(Long wardId) {
        return named(wardId == null ? activity.findTop50ByOrderByIdDesc() : activity.findTop50ByWardIdOrderByIdDesc(wardId));
    }

    @Transactional(readOnly = true)
    public List<Entry> recentBy(long actorId) {
        return named(activity.findTop50ByActorIdOrderByIdDesc(actorId));
    }

    /** officer id -> {last action time, number of actions} */
    @Transactional(readOnly = true)
    public Map<Long, Object[]> summaryByOfficer() {
        return activity.summaryByActor().stream().collect(Collectors.toMap(r -> (Long) r[0], r -> r));
    }

    @Transactional(readOnly = true)
    public Map<Long, LocalDateTime> lastActionByWard() {
        return activity.lastActionByWard().stream().collect(Collectors.toMap(r -> (Long) r[0], r -> (LocalDateTime) r[1]));
    }

    private List<Entry> named(List<MunicipalActivity> rows) {
        Set<Long> ids = rows.stream().map(MunicipalActivity::getActorId).collect(Collectors.toSet());
        Map<Long, UserAccount> actors = users.getAll(ids);
        return rows.stream().map(a -> new Entry(a.getId(), a.getActorId(),
                actors.containsKey(a.getActorId()) ? actors.get(a.getActorId()).name() : "?", a.getWardId(),
                a.getCode(), a.getDetail(), a.getCreatedAt())).toList();
    }
}
