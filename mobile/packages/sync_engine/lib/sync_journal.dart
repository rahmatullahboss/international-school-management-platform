import 'package:school_mobile_core/mobile_core.dart';
import 'package:school_sync_engine/school_sync_engine.dart';

abstract interface class SyncOperationJournal {
  Future<List<SyncOperationEnvelope>> listOperations({
    required SchoolSession session,
    Set<SyncOperationKind>? kinds,
    Set<SyncOperationState>? states,
    int limit = 100,
  });
}
