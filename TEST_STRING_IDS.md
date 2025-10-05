# Test du Système String-Based Block IDs

## 🧪 Plan de Test

### ✅ Test 1 : Vérifier les logs de démarrage

**Serveur** :
```
[BlockRegistry] Initialized with 6 official blocks
[BlockRegistry] Mapping table: [
  { stringId: 'vaste:air', numericId: 0 },
  { stringId: 'vaste:stone', numericId: 1 },
  { stringId: 'vaste:dirt', numericId: 2 },
  { stringId: 'vaste:grass', numericId: 3 },
  { stringId: 'vaste:wood', numericId: 4 },
  { stringId: 'vaste:sand', numericId: 5 }
]
[FlatworldGenerator] Block IDs: stone=1, dirt=2, grass=3
```

**Client (Console F12)** :
```
[BlockRegistry] Initialized with string-based system
[BlockRegistry] Registered 6 official blocks
[Network] Received block mapping table: 6 blocks
[BlockMapping] Loaded mappings: [[vaste:air, 0], [vaste:stone, 1], ...]
```

### ✅ Test 2 : Connexion et sync

1. Connecte-toi au serveur
2. Vérifie dans la console client :
   - `[Network] Received block mapping table: X blocks`
   - `[BlockMapping] Loaded mappings:`
3. Le monde doit se charger normalement

### ✅ Test 3 : Affichage des blocs

1. Le monde doit s'afficher avec les bonnes textures :
   - ✅ Stone (gris)
   - ✅ Dirt (marron)
   - ✅ Grass (vert dessus, marron côtés)
2. **Plus de magenta** (sauf si texture réellement manquante)

### ✅ Test 4 : Sauvegarde du monde

1. Arrête le serveur proprement
2. Vérifie `gameserver/mods/test/flatworld/world.json` :
   ```json
   {
     "generatorType": "flatworld",
     "blockMappings": [
       { "stringId": "vaste:air", "numericId": 0 },
       { "stringId": "vaste:stone", "numericId": 1 },
       ...
     ],
     "savedAt": "2025-..."
   }
   ```

### ✅ Test 5 : Rechargement du monde

1. Redémarre le serveur
2. Vérifie les logs :
   - `[WorldStorage] Restored X block mappings from save file`
3. Le monde doit se charger identiquement

### ✅ Test 6 : Ajouter un nouveau bloc

**1. Ajoute au client** (`app/client/src/data/BlockRegistry.ts`) :
```typescript
["vaste:test_block", {
  stringId: "vaste:test_block",
  name: "test_block",
  displayName: "Test Block",
  solid: true,
  transparent: false,
}],
```

**2. Ajoute au serveur** (`gameserver/BlockRegistry.js`) :
```javascript
["vaste:test_block", {
  stringId: "vaste:test_block",
  name: "test_block",
  displayName: "Test Block",
  solid: true,
  transparent: false,
}],
```

**3. Crée le blockpack** :
```
app/client/public/blockpacks/test_block/
├── block.json
└── textures/
    └── test_block.png
```

**4. block.json** :
```json
{
  "name": "test_block",
  "textures": {
    "all": "/blockpacks/test_block/textures/test_block.png"
  }
}
```

**5. Redémarre** et vérifie les logs :
- Serveur : `[BlockRegistry] Registered 7 official blocks`
- Client : `[Network] Received block mapping table: 7 blocks`

---

## 🐛 Problèmes Potentiels

### Erreur : "Cannot find module BlockRegistry"
**Cause** : Cache TypeScript  
**Solution** : Redémarre VS Code ou relance le build

### Les blocs ne s'affichent pas
**Cause** : Mapping pas synchronisé  
**Solution** : Vérifie les logs réseau, regarde si `block_mapping` est envoyé/reçu

### Monde vide après redémarrage
**Cause** : `blockMappings` pas sauvegardé  
**Solution** : Vérifie `world.json`, regarde si `blockMappings` est présent

### IDs changés après ajout de bloc
**Cause** : Ancien monde sans `blockMappings` dans `world.json`  
**Solution** : C'est normal pour un ancien monde. Crée un nouveau monde pour tester.

---

## 📝 Checklist Complète

- [ ] Serveur démarre sans erreur
- [ ] Client compile sans erreur
- [ ] Logs montrent le mapping chargé (serveur + client)
- [ ] Message `block_mapping` envoyé à la connexion
- [ ] Monde s'affiche avec textures correctes
- [ ] Grass a la bonne texture (top vert, side marron)
- [ ] `world.json` contient `blockMappings`
- [ ] Rechargement du monde fonctionne
- [ ] Ajout d'un nouveau bloc fonctionne

---

## 🚀 Commandes de Test

```powershell
# Lancer les serveurs
.\start.bat

# Supprimer l'ancien monde (pour test propre)
Remove-Item -Recurse -Force gameserver/mods/test/flatworld

# Vérifier le world.json
Get-Content gameserver/mods/test/flatworld/world.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

---

## ✨ Résultat Attendu

**Tout doit fonctionner exactement comme avant**, MAIS maintenant :
- ✅ Tu utilises uniquement des string IDs (`"vaste:stone"`)
- ✅ Pas besoin de gérer les IDs numériques manuellement
- ✅ Ajout de blocs ultra simplifié
- ✅ Prêt pour le modding
