import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { moveSaves, type Save } from '../db/repo';
import { haptic } from '../lib/haptics';
import { CollectionPicker } from './CollectionPicker';
import { Sheet } from './Sheet';
import { Button } from './ui';

function MoveForm({ saves, onClose, onMoved }: { saves: Save[]; onClose: () => void; onMoved?: () => void }) {
  const db = useSQLiteContext();
  const current = saves[0].collection_id;
  const [target, setTarget] = useState(current);
  const allThere = saves.every((s) => s.collection_id === target);
  return (
    <>
      <CollectionPicker value={target} onChange={setTarget} />
      <Button
        title={saves.length > 1 ? `Move ${saves.length} saves here` : 'Move here'}
        size="lg"
        disabled={allThere}
        onPress={async () => {
          await moveSaves(
            db,
            saves.map((s) => s.id),
            target,
          );
          haptic.success();
          onMoved?.();
          onClose();
        }}
      />
    </>
  );
}

export function MoveSheet({ saves, onClose, onMoved }: { saves: Save[] | null; onClose: () => void; onMoved?: () => void }) {
  return (
    <Sheet visible={!!saves?.length} onClose={onClose} title="Move to collection">
      {saves?.length ? <MoveForm key={saves.map((s) => s.id).join()} saves={saves} onClose={onClose} onMoved={onMoved} /> : null}
    </Sheet>
  );
}
