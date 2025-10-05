# Adding Blocks to Vaste

## 🎯 Quick Start

Ajouter un bloc est maintenant **ultra simple** ! Plus besoin de gérer des IDs numériques.

### Étapes pour ajouter un bloc officiel :

1. **Ajouter le bloc au registre** (`app/client/src/data/BlockRegistry.ts`)
2. **Créer le blockpack** avec textures
3. **C'est tout !** 🎉

---

## 📝 Étape 1 : Ajouter au registre

Ouvrez `app/client/src/data/BlockRegistry.ts` et ajoutez votre bloc à `BLOCK_REGISTRY` :

```typescript
export const BLOCK_REGISTRY = new Map<string, BlockDefinition>([
  // ... blocs existants ...
  
  ["vaste:ruby_ore", {
    stringId: "vaste:ruby_ore",
    name: "ruby_ore",
    displayName: "Ruby Ore",
    solid: true,
    transparent: false,
  }],
]);
```

**C'est tout pour le code !** Le système génère automatiquement un ID numérique temporaire pour le réseau.

### Format du String ID

- **Structure** : `"namespace:blockname"`
- **Namespace** : `vaste` pour blocs officiels, `modname` pour mods
- **Blockname** : Nom technique du bloc (minuscules, underscores)

**Exemples** :
- Blocs officiels : `"vaste:stone"`, `"vaste:grass"`, `"vaste:ruby_ore"`
- Blocs de mods : `"mymod:copper"`, `"othermod:steel"`

---

## 📦 Étape 2 : Créer le blockpack

### Structure des fichiers

```
app/client/public/blockpacks/
└── [blockname]/           # Nom technique (sans namespace)
    ├── block.json         # Configuration
    └── textures/
        └── [nom].png      # Texture(s)
```

**Exemple pour `ruby_ore`** :

```
app/client/public/blockpacks/
└── ruby_ore/
    ├── block.json
    └── textures/
        └── ruby_ore.png
```

### Configuration : `block.json`

#### Texture unique (tous les côtés identiques)

```json
{
  "name": "ruby_ore",
  "textures": {
    "all": "/blockpacks/ruby_ore/textures/ruby_ore.png"
  }
}
```

#### Textures multiples (différents côtés)

```json
{
  "name": "grass",
  "textures": {
    "top": "/blockpacks/grass/textures/grass_top.png",
    "side": "/blockpacks/grass/textures/grass_side.png",
    "bottom": "/blockpacks/grass/textures/dirt.png"
  }
}
```

**Propriétés disponibles** :
- `all` : Texture pour tous les côtés
- `top` : Texture du dessus
- `bottom` : Texture du dessous
- `side` : Texture des 4 côtés

---

## 📊 Blocs Actuels

| String ID | Nom Technique | Nom Affiché | Textures |
|-----------|---------------|-------------|----------|
| `vaste:air` | air | Air | Aucune (transparent) |
| `vaste:stone` | stone | Stone | all |
| `vaste:dirt` | dirt | Dirt | all |
| `vaste:grass` | grass | Grass | top, side, bottom |
| `vaste:wood` | wood | Wood | all |
| `vaste:sand` | sand | Sand | all |

---

## 🔧 Comment ça fonctionne ?

### Architecture Invisible (automatique)

1. **Au démarrage du serveur** :
   - Le serveur lit `BlockRegistry.js`
   - Génère automatiquement des IDs numériques temporaires (ex: stone=1, dirt=2, etc.)
   - Crée une table de mapping `stringId <-> numericId`

2. **À la connexion du client** :
   - Le serveur envoie la table de mapping au client
   - Le client synchronise son registre avec celui du serveur
   - Tout fonctionne !

3. **Pendant le jeu** :
   - **Réseau** : Utilise les IDs numériques (efficace, 2 bytes)
   - **Stockage** : Sauvegarde les string IDs (future-proof)
   - **Code** : Tu utilises uniquement les string IDs !

### Pourquoi ce système ?

✅ **Simple** : Pas besoin de gérer les IDs numériques  
✅ **Pas de conflits** : Système de namespaces (`vaste:`, `mymod:`)  
✅ **Performant** : Réseau optimisé avec IDs numériques  
✅ **Modding** : Les mods peuvent ajouter des blocs sans conflits  
✅ **Save files** : Les mondes sauvegardés fonctionnent toujours

---

## 🚀 Exemple Complet

### Ajouter un bloc "Copper Ore"

**1. Registre** (`BlockRegistry.ts`) :

```typescript
["vaste:copper_ore", {
  stringId: "vaste:copper_ore",
  name: "copper_ore",
  displayName: "Copper Ore",
  solid: true,
  transparent: false,
}],
```

**2. Créer le dossier** :

```
app/client/public/blockpacks/copper_ore/
```

**3. Créer `block.json`** :

```json
{
  "name": "copper_ore",
  "textures": {
    "all": "/blockpacks/copper_ore/textures/copper_ore.png"
  }
}
```

**4. Ajouter la texture** :

Créer `app/client/public/blockpacks/copper_ore/textures/copper_ore.png` (16x16 pixels recommandé)

**5. Redémarrer** et profiter ! 🎉

---

## 🛠️ Troubleshooting

### Bloc en magenta (#FF00FF)

**Problème** : Le bloc s'affiche en violet/magenta vif.

**Solutions** :
1. Vérifier que le blockpack existe : `/blockpacks/[nom]/`
2. Vérifier le `block.json` (syntaxe JSON valide)
3. Vérifier les chemins des textures
4. Vérifier que les textures existent et sont accessibles
5. Regarder la console (F12) pour les erreurs de chargement

### Bloc invisible

**Problème** : Le bloc ne s'affiche pas du tout.

**Solutions** :
1. Vérifier `solid: true` dans le registre
2. Vérifier que le serveur envoie bien le bloc
3. Consulter les logs du serveur et du client

### Bloc ne se génère pas dans le monde

**Problème** : Le bloc ne spawn pas naturellement.

**Solution** : Modifier le générateur de terrain dans `gameserver/world/chunkGenerator.js` ou créer un mod qui utilise l'API Vaste pour placer des blocs.

---

## 🎮 Pour les Mods

Les mods peuvent ajouter leurs propres blocs avec leur **propre namespace** :

```typescript
// Dans le mod
registerBlock({
  stringId: "mymod:ruby_ore",
  name: "ruby_ore",
  displayName: "Ruby Ore",
  solid: true,
  transparent: false,
});
```

Le serveur assignera automatiquement un ID numérique unique. **Aucun conflit possible** entre mods !

Voir `MODDING_ARCHITECTURE.md` pour plus de détails.
