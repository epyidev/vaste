# Système de Modding - Architecture des Blocs

## 🎯 Architecture Hybride

Vaste utilise un **système d'IDs hybride** optimisé pour :
- Performance réseau/stockage (IDs numériques)
- Extensibilité des mods (IDs string avec namespaces)

## 📊 Flux de données

```
Client/Serveur (interne)     Mods (externe)
─────────────────────────   ─────────────────
Numeric IDs (0-65535)   ←→  String IDs ("mod:block")
     ↓                            ↓
  Réseau rapide              Pas de conflits
  Stockage compact           Namespaces uniques
```

## 🔢 Allocation des IDs

| Plage | Usage | Exemple |
|-------|-------|---------|
| 0 | Air (réservé) | 0 = air |
| 1-1000 | Blocs officiels | 1 = stone, 2 = dirt, ... |
| 1001-65535 | Blocs de mods | 1001 = "mymod:ruby", 1002 = "othermod:copper" |

## 🔌 API de Modding (Futur)

### Enregistrement d'un bloc

```javascript
// Dans le fichier principal du mod
export function onModLoad() {
  // Enregistrer un nouveau type de bloc
  const rubyOreId = registerBlock({
    stringId: "mymod:ruby_ore",
    name: "ruby_ore",
    displayName: "Ruby Ore",
    solid: true,
    transparent: false,
    
    // Optionnel : propriétés avancées
    hardness: 3,
    resistance: 3,
    lightLevel: 0,
    
    // Comportements
    onBreak: (player, pos) => {
      // Logique personnalisée
      dropItem(player, pos, "mymod:ruby", Math.floor(Math.random() * 3) + 1);
    }
  });
  
  console.log(`Ruby Ore registered with numeric ID: ${rubyOreId}`);
}
```

### Ajout de textures

```
mods/mymod/
├── mod.json
├── main.js
└── blockpacks/
    └── ruby_ore/
        ├── block.json
        └── textures/
            └── ruby_ore.png
```

Le serveur copiera automatiquement les blockpacks vers le client.

### Résolution des IDs

```javascript
// Dans le code du mod
const rubyOreNumericId = getNumericId("mymod:ruby_ore");
const rubyOreStringId = getStringId(1001);

// Placer un bloc
setBlock(x, y, z, "mymod:ruby_ore");

// Le serveur traduit automatiquement en ID numérique pour le réseau
```

## 🌐 Synchronisation Client/Serveur

### Au démarrage du serveur :
1. Le serveur charge tous les mods
2. Chaque mod enregistre ses blocs avec des string IDs
3. Le serveur assigne des IDs numériques uniques (1001+)
4. Le serveur crée une **table de mapping** : `stringId <-> numericId`

### À la connexion d'un client :
1. Le serveur envoie la table de mapping complète
2. Le client synchronise son registre local
3. Le client télécharge les blockpacks manquants
4. Communication prête (client et serveur utilisent les mêmes IDs)

### Pendant le jeu :
- **Réseau** : IDs numériques uniquement (efficace)
- **Stockage** : IDs numériques + table de mapping sauvegardée
- **Logs** : String IDs pour lisibilité

## 🔄 Compatibilité des Mondes

### Problème classique :
```
Monde créé avec :        Monde rechargé avec :
1 = stone                1 = stone
2 = dirt                 2 = dirt
1001 = "modA:ruby"       1001 = "modB:copper"  ❌ ERREUR!
```

### Solution Vaste :
La table de mapping est **sauvegardée avec le monde** :

```json
{
  "blockMappings": {
    "1": "vaste:stone",
    "2": "vaste:dirt",
    "1001": "modA:ruby",
    "1002": "modB:copper"
  }
}
```

Au chargement :
1. Lire la table du monde
2. Ré-assigner les mêmes IDs numériques aux mêmes string IDs
3. Les nouveaux mods obtiennent de nouveaux IDs libres

## 🚀 Avantages

✅ **Performance** : réseau compact (2 bytes par bloc)  
✅ **Flexibilité** : mods indépendants avec namespaces  
✅ **Compatibilité** : mondes sauvegardés fonctionnent toujours  
✅ **Pas de conflits** : même si 2 mods ont des blocs similaires  
✅ **Ordre de chargement** : peu importe l'ordre des mods  

## 📝 TODO (Implémentation future)

- [ ] API `registerBlock()` côté serveur
- [ ] Synchronisation de la table de mapping au client
- [ ] Téléchargement automatique des blockpacks de mods
- [ ] Sauvegarde de la table avec les mondes
- [ ] UI de gestion des mods
- [ ] Validation des string IDs (format, unicité)
- [ ] Hot-reload des mods en développement
