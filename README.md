# State Management Built around Undo

This state management system is built around two concepts:

1. State is accessed and set primarily through lenses that can be split off and composed.
2. A transaction can be initiated from the state tree, which records mutations in a separate branch until the
   transaction is committed.

