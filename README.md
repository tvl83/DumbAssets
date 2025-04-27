# DumbAssets

A simple, powerful asset tracker for keeping track of your physical assets and their components.

## Features

- Track assets with detailed information (model numbers, serial numbers, warranty info)
- Add components to assets with up to two levels of sub-components
- Upload and store photos of assets and receipts
- Search for assets by name, model number, serial number, or description
- Hierarchical organization of components

## Getting Started

### Prerequisites

- Node.js 14.x or higher
- npm or yarn

### Installation

1. Clone the repository
```
git clone https://github.com/yourusername/DumbAssets.git
cd DumbAssets
```

2. Install dependencies
```
npm install
```

3. Start the server
```
npm start
```

4. Open your browser and navigate to `http://localhost:3000`

## Usage

### Managing Assets

- Click "Add Asset" to create a new asset
- Fill in the asset details including optional photo and receipt
- Click on an asset in the sidebar to view its details
- Use the Edit and Delete buttons to modify or remove assets

### Managing Components

- Select an asset first
- Click "Add Component" to add a component to the selected asset
- Components can have their own details, photos, and receipts
- First-level components can have sub-components (second level)

### Searching

- Use the search bar in the sidebar to find assets by name, model number, serial number, or description

## Data Storage

All data is stored in JSON files in the `/data` directory:

- `/data/Assets.json` - Contains all asset data
- `/data/SubAssets.json` - Contains all component data
- `/data/Images` - Stores uploaded asset and component photos
- `/data/Receipts` - Stores uploaded receipts

## Built With

- [Express](https://expressjs.com/) - Web framework
- [Multer](https://github.com/expressjs/multer) - File upload handling

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built by [DumbWare](https://dumbware.io) 