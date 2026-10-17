import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { moveSave, type Save } from '../db/repo';
import { haptic } from '../lib/haptics';
import { CollectionPicker } from './CollectionPicker';
import { Sheet } from './Sheet';
import { Button } from './ui';

function MoveForm({ save, onClose }: { save: Save; onClose: () => void }) {
  const db = useSQLiteContext();
  const [target, setTarget] = useState(save.collection_id);
  return (
    <>
      <CollectionPicker value={target} onChange={setTarget} />
      <Button
        title="Move here"
        size="lg"
        disabled={target === save.collection_id}
        onPress={async () => {
          await moveSave(db, save.id, target);
          haptic.success();
          onClose();
        }}
      />
    </>
  );
}

export function MoveSheet({ save, onClose }: { save: Save | null; onClose: () => void }) {
  return (
    <Sheet visible={!!save} onClose={onClose} title="Move to collection">
      {save ? <MoveForm key={save.id} save={save} onClose={onClose} /> : null}
    </Sheet>
  );
}
