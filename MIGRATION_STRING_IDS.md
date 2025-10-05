# Migration vers le système String-Based Block IDs

## ✅ Changements Effectués

### 🎯 Objectif
Simplifier complètement l'ajout de blocs en éliminant la gestion manuelle des IDs numériques.

### 📝 Principe
- **Avant** : Tu devais gérer des IDs numériques (1, 2, 3...) et éviter les conflits
- **Après** : Tu utilises uniquement des string IDs (`"vaste:stone"`) et tout est automatique !

---

## 🔄 Modifications du Code

### 1. Client - BlockRegistry.ts (Complètement réécrit)

**Ancien système** :
```typescript
export enum BlockType {
  AIR = 0,
  STONE = 1,
  DIRT = 2,
  // ...
}

export const BLOCK_REGISTRY: Record<number, BlockDefinition> = {
  [BlockType.STONE]: { id: 1, name: "stone", ... }
}
```

**Nouveau système** :
```typescript
export const BLOCK_REGISTRY = new Map<string, BlockDefinition>([
  ["vaste:stone", {
    stringId: "vaste:stone",
    name: "stone",
    displayName: "Stone",
    solid: true,
    transparent: false,
  }],
]);

// Classe BlockMappingManager génère automatiquement les IDs numériques
export const blockMapping = new BlockMappingManager();
```

**Fonctionnalités** :
- ✅ Plus de `BlockType` enum à maintenir
- ✅ `BlockMappingManager` auto-génère les IDs numériques (0, 1, 2, ...)
- ✅ Mapping bidirectionnel `stringId ↔ numericId`
- ✅ Fonctions helpers acceptent string OU numeric : `getBlockName("vaste:stone")` ou `getBlockName(1)`

### 2. Serveur - BlockRegistry.js (Nouveau fichier)

**Créé** : `gameserver/BlockRegistry.js`

**Identique au client mais en JavaScript** :
```javascript
const BLOCK_REGISTRY = new Map([
  ["vaste:stone", { stringId: "vaste:stone", name: "stone", ... }],
]);

class BlockMappingManager { /* ... */ }

const blockMapping = new BlockMappingManager();
```

**Exportations** :
- `BLOCK_REGISTRY` : Map des blocs
- `blockMapping` : Instance de mapping manager
- Fonctions helpers : `getBlockName()`, `isBlockSolid()`, etc.

### 3. Synchronisation Client/Serveur

**Serveur** (`gameserver/server.js`) :
```javascript
// À la connexion du joueur, envoie la table de mapping
const { blockMapping } = require('./BlockRegistry');
ws.send(JSON.stringify({
  type: "block_mapping",
  mappings: blockMapping.exportMappingTable()
}));
```

**Client** (`app/client/src/network.ts`) :
```typescript
// Réception de la table de mapping
case "block_mapping":
  blockMapping.loadMappingTable(message.mappings);
  break;
```

**Résultat** : Client et serveur utilisent les **mêmes IDs numériques** pour la session.

### 4. Stockage Monde avec Mapping

**Fichier** : `gameserver/world/WorldStorage.js`

**Sauvegarde** (`saveMetadata`) :
```javascript
const enrichedMetadata = {
  ...metadata,
  blockMappings: blockMapping.exportMappingTable(), // ⭐ Sauvegarde la table !
  savedAt: new Date().toISOString()
};
```

**Chargement** (`loadMetadata`) :
```javascript
if (metadata.blockMappings) {
  // Restore les IDs numériques exacts du monde sauvegardé
  for (const { stringId, numericId } of metadata.blockMappings) {
    blockMapping.registerBlock(stringId, numericId);
  }
}
```

**Format du world.json** :
```json
{
  "generatorType": "flatworld",
  "spawnPoint": { "x": 0, "y": 46, "z": 0 },
  "blockMappings": [
    { "stringId": "vaste:air", "numericId": 0 },
    { "stringId": "vaste:stone", "numericId": 1 },
    { "stringId": "vaste:dirt", "numericId": 2 },
    { "stringId": "vaste:grass", "numericId": 3 }
  ]
}
```

**Avantages** :
- ✅ Les mondes sauvegardés fonctionnent **toujours** même si tu changes l'ordre des blocs
- ✅ Compatibilité totale avec les mods ajoutés/retirés

### 5. Générateur de Terrain

**Fichier** : `gameserver/world/generators/FlatworldGenerator.js`

**Avant** :
```javascript
if (depthFromTop < this.grassLayers) {
  blockType = 3; // Grass - ID en dur ❌
}
```

**Après** :
```javascript
constructor(options) {
  // Récupère les IDs automatiquement
  this.stoneId = blockMapping.getNumericId('vaste:stone');
  this.dirtId = blockMapping.getNumericId('vaste:dirt');
  this.grassId = blockMapping.getNumericId('vaste:grass');
}

// Utilise les IDs récupérés
if (depthFromTop < this.grassLayers) {
  blockType = this.grassId; // ✅
}
```

### 6. TextureAtlasManager

**Fichier** : `app/client/src/utils/TextureAtlasManager.ts`

**Changements** :
- ✅ `getMaterialForBlock()` accepte maintenant `string | number`
- ✅ Utilise `getBlockName(stringIdOrNumeric)` pour convertir automatiquement
- ✅ Plus de références à `BlockType` enum

**Exemple** :
```typescript
getMaterialForBlock(blockTypeOrStringId: number | string) {
  const blockName = getBlockName(blockTypeOrStringId); // Convertit auto
  const texture = this.getTexture(blockName);
  // ...
}
```

### 7. Documentation

**ADDING_BLOCKS.md** : Complètement réécrit
- ✅ Explique le nouveau système simplifié
- ✅ Guide étape par étape sans IDs numériques
- ✅ Exemples clairs

**MODDING_ARCHITECTURE.md** : Mis à jour
- ✅ Explique le système de namespaces
- ✅ API de modding future

---

## 🎮 Flux de Données

### Au démarrage du serveur :
1. `BlockRegistry.js` charge tous les blocs
2. `BlockMappingManager` génère des IDs numériques (0, 1, 2, ...)
3. Table de mapping créée : `{ "vaste:stone" → 1, "vaste:dirt" → 2, ... }`

### À la connexion d'un client :
1. Serveur envoie message `block_mapping` avec la table complète
2. Client charge la table dans son `blockMapping`
3. Client et serveur **synchronisés** sur les IDs numériques

### Pendant le jeu :
- **Réseau** : Utilise IDs numériques (Uint16Array, 2 bytes, efficace)
- **Code** : Tu utilises string IDs (`"vaste:stone"`)
- **Conversion automatique** via `blockMapping.getNumericId()` / `getStringId()`

### Sauvegarde du monde :
1. Chunks sauvegardés avec IDs numériques (format binaire compact)
2. `world.json` contient la table de mapping `stringId ↔ numericId`
3. Au chargement : mapping restauré → IDs cohérents

---

## 🚀 Pour Ajouter un Bloc Maintenant

### Étape 1 : Ajouter au registre

**Client** (`app/client/src/data/BlockRegistry.ts`) :
```typescript
["vaste:copper_ore", {
  stringId: "vaste:copper_ore",
  name: "copper_ore",
  displayName: "Copper Ore",
  solid: true,
  transparent: false,
}],
```

**Serveur** (`gameserver/BlockRegistry.js`) :
```javascript
["vaste:copper_ore", {
  stringId: "vaste:copper_ore",
  name: "copper_ore",
  displayName: "Copper Ore",
  solid: true,
  transparent: false,
}],
```

### Étape 2 : Créer le blockpack

```
app/client/public/blockpacks/copper_ore/
├── block.json
└── textures/
    └── copper_ore.png
```

**block.json** :
```json
{
  "name": "copper_ore",
  "textures": {
    "all": "/blockpacks/copper_ore/textures/copper_ore.png"
  }
}
```

### C'est tout ! 🎉

Plus besoin de :
- ❌ Gérer des IDs numériques manuellement
- ❌ Éviter les conflits d'IDs
- ❌ Mettre à jour plusieurs endroits
- ❌ S'inquiéter de l'ordre des blocs

---

## 🔮 Prochaines Étapes (Modding)

Le système est **prêt pour le modding** :

```lua
-- Dans un mod Lua
vaste.registerBlock({
  stringId = "mymod:ruby_ore",
  name = "ruby_ore",
  displayName = "Ruby Ore",
  solid = true,
  transparent = false
})

-- Le serveur assignera automatiquement un ID numérique unique
-- Aucun conflit possible avec d'autres mods !
```

---

## 📊 Récapitulatif des Fichiers Modifiés

### Créés :
- ✅ `app/client/src/data/BlockRegistry.ts` (nouveau système)
- ✅ `gameserver/BlockRegistry.js` (nouveau système)
- ✅ `ADDING_BLOCKS.md` (doc simplifiée)

### Modifiés :
- ✅ `app/client/src/network.ts` (handler `block_mapping`)
- ✅ `app/client/src/utils/TextureAtlasManager.ts` (support string IDs)
- ✅ `gameserver/server.js` (envoi table de mapping)
- ✅ `gameserver/world/WorldStorage.js` (save/load mapping)
- ✅ `gameserver/world/generators/FlatworldGenerator.js` (IDs dynamiques)
- ✅ `MODDING_ARCHITECTURE.md` (architecture mise à jour)

### Pas modifiés (déjà compatibles) :
- ✅ `gameserver/world/Chunk.js` (stocke toujours Uint16Array)
- ✅ `app/client/src/workers/chunkDecoderWorker.ts` (décode Uint16Array)
- ✅ Tous les fichiers de chunks/regions (format binaire inchangé)

---

## ✨ Résultat Final

**Tu ajoutes maintenant un bloc en 2 étapes** :
1. Ajouter `["vaste:nom", {...}]` dans BlockRegistry
2. Créer le blockpack avec textures

**Le système gère automatiquement** :
- Génération des IDs numériques
- Synchronisation client/serveur
- Sauvegarde de la table de mapping
- Compatibilité des mondes sauvegardés
- Support du modding futur

**Zero configuration, zero conflit, zero problème !** 🚀
