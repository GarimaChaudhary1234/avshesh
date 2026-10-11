package com.avshesh.ward;

import java.util.List;
import java.util.Optional;

public interface WardDirectory {

    Optional<WardInfo> find(long wardId);

    List<WardInfo> all();
}
