/**
 * Tests for data migration functionality
 * 
 * Tests the conversion between nested and flattened data structures
 */

const dataMigrationTests = {
  name: 'Data Migration Tests',
  
  setup(runner) {
    // Sample nested data structure
    const sampleNestedData = {
      'component1': {
        'category1': {
          'rule1': { checked: true, timestamp: '2025-04-10T14:00:00Z' },
          'rule2': { checked: false, timestamp: null }
        },
        'category2': {
          'rule3': { checked: true, timestamp: '2025-04-11T15:30:00Z' }
        }
      },
      'component2': {
        'category1': {
          'rule1': { checked: false, timestamp: null },
          'rule2': { checked: true, timestamp: '2025-04-12T09:45:00Z' }
        }
      }
    };
    
    // Mock storage manager with migration capabilities
    class MockMigrationManager {
      constructor() {
        this.checkboxStates = {};
        this.flatCheckboxItems = [];
        this.useFlattened = false;
      }
      
      setNestedData(data) {
        this.checkboxStates = JSON.parse(JSON.stringify(data));
      }
      
      migrateToFlatStructure() {
        const flatItems = [];
        
        Object.entries(this.checkboxStates).forEach(([componentId, categories]) => {
          Object.entries(categories).forEach(([category, rules]) => {
            Object.entries(rules).forEach(([ruleText, state]) => {
              flatItems.push({
                id: `${componentId}:${category}:${ruleText}`,
                componentId,
                category,
                ruleText,
                checked: state.checked,
                timestamp: state.timestamp
              });
            });
          });
        });
        
        this.flatCheckboxItems = flatItems;
        return flatItems;
      }
      
      migrateToNestedStructure() {
        const nestedData = {};
        
        this.flatCheckboxItems.forEach(item => {
          if (!nestedData[item.componentId]) {
            nestedData[item.componentId] = {};
          }
          
          if (!nestedData[item.componentId][item.category]) {
            nestedData[item.componentId][item.category] = {};
          }
          
          nestedData[item.componentId][item.category][item.ruleText] = {
            checked: item.checked,
            timestamp: item.timestamp
          };
        });
        
        this.checkboxStates = nestedData;
        return nestedData;
      }
      
      setUseFlattenedStructure(useFlattened) {
        this.useFlattened = useFlattened;
      }
      
      getFlatCheckboxItems() {
        return [...this.flatCheckboxItems];
      }
      
      getFlatCheckboxItemsForComponent(componentId) {
        return this.flatCheckboxItems.filter(item => item.componentId === componentId);
      }
      
      updateFlatCheckboxItem(componentId, category, ruleText, checked, timestamp) {
        const itemId = `${componentId}:${category}:${ruleText}`;
        const existingIndex = this.flatCheckboxItems.findIndex(item => item.id === itemId);
        
        if (existingIndex !== -1) {
          this.flatCheckboxItems[existingIndex].checked = checked;
          this.flatCheckboxItems[existingIndex].timestamp = timestamp;
        } else {
          this.flatCheckboxItems.push({
            id: itemId,
            componentId,
            category,
            ruleText,
            checked,
            timestamp
          });
        }
      }
    }
    
    // Run before all tests
    runner.beforeAll(() => {
      // Create migration manager
      window._testMigrationManager = new MockMigrationManager();
    });
    
    // Run after all tests
    runner.afterAll(() => {
      // Clean up
      delete window._testMigrationManager;
    });
    
    // Reset before each test
    runner.beforeEach(() => {
      const migrationManager = window._testMigrationManager;
      migrationManager.setNestedData(sampleNestedData);
      migrationManager.flatCheckboxItems = [];
      migrationManager.useFlattened = false;
    });
    
    // Basic Migration Tests
    runner.test('Should correctly migrate from nested to flat structure', () => {
      const migrationManager = window._testMigrationManager;
      
      // Migrate to flat structure
      const flatItems = migrationManager.migrateToFlatStructure();
      
      // Count expected items
      let expectedCount = 0;
      Object.values(sampleNestedData).forEach(component => {
        Object.values(component).forEach(category => {
          expectedCount += Object.keys(category).length;
        });
      });
      
      // Check item count
      assert.equals(flatItems.length, expectedCount, 
        `Should create ${expectedCount} flat items`);
      
      // Check a specific item
      const testItem = flatItems.find(item => 
        item.componentId === 'component1' && 
        item.category === 'category1' && 
        item.ruleText === 'rule1'
      );
      
      assert.isNotNullOrUndefined(testItem, 'Test item should exist');
      assert.isTrue(testItem.checked, 'Test item should be checked');
      assert.equals(testItem.timestamp, '2025-04-10T14:00:00Z', 'Timestamp should match');
    });
    
    // Nested Structure Updates
    runner.test('Should update nested structure when flat items change', () => {
      const migrationManager = window._testMigrationManager;
      
      // Migrate to flat structure
      migrationManager.migrateToFlatStructure();
      
      // Enable flattened structure
      migrationManager.setUseFlattenedStructure(true);
      
      // Update a flat item
      const componentId = 'component1';
      const category = 'category1';
      const ruleText = 'rule1';
      const newTimestamp = '2025-04-28T20:00:00Z';
      
      migrationManager.updateFlatCheckboxItem(
        componentId, 
        category, 
        ruleText, 
        false,  // Change from true to false
        newTimestamp
      );
      
      // Migrate back to nested
      const nestedData = migrationManager.migrateToNestedStructure();
      
      // Check the updated item in nested structure
      const updatedState = nestedData[componentId][category][ruleText];
      assert.isNotNullOrUndefined(updatedState, 'Item should exist in nested structure');
      assert.isFalse(updatedState.checked, 'Item should be unchecked');
      assert.equals(updatedState.timestamp, newTimestamp, 'Timestamp should be updated');
    });
    
    // Component Filtering Tests
    runner.test('Should correctly filter flat items by component ID', () => {
      const migrationManager = window._testMigrationManager;
      
      // Migrate to flat structure
      migrationManager.migrateToFlatStructure();
      
      // Get items for component1
      const component1Items = migrationManager.getFlatCheckboxItemsForComponent('component1');
      
      // Count expected items for component1
      let expectedCount = 0;
      Object.values(sampleNestedData['component1']).forEach(category => {
        expectedCount += Object.keys(category).length;
      });
      
      // Check item count
      assert.equals(component1Items.length, expectedCount, 
        `Should find ${expectedCount} items for component1`);
      
      // Check all items are for component1
      assert.isTrue(component1Items.every(item => item.componentId === 'component1'), 
        'All items should be for component1');
    });
    
    // Adding New Items Tests
    runner.test('Should correctly add new flat items', () => {
      const migrationManager = window._testMigrationManager;
      
      // Migrate to flat structure
      migrationManager.migrateToFlatStructure();
      
      // Add a new item for an existing component
      const componentId = 'component1';
      const category = 'newCategory';
      const ruleText = 'newRule';
      const timestamp = '2025-04-28T20:15:00Z';
      
      migrationManager.updateFlatCheckboxItem(
        componentId,
        category,
        ruleText,
        true,
        timestamp
      );
      
      // Check if item was added
      const allItems = migrationManager.getFlatCheckboxItems();
      const newItem = allItems.find(item => 
        item.componentId === componentId && 
        item.category === category && 
        item.ruleText === ruleText
      );
      
      assert.isNotNullOrUndefined(newItem, 'New item should be added');
      assert.isTrue(newItem.checked, 'New item should be checked');
      assert.equals(newItem.timestamp, timestamp, 'Timestamp should match');
    });
    
    // Item ID Format Tests
    runner.test('Should use correct ID format for flat items', () => {
      const migrationManager = window._testMigrationManager;
      
      // Migrate to flat structure
      const flatItems = migrationManager.migrateToFlatStructure();
      
      // Check ID format
      flatItems.forEach(item => {
        const expectedId = `${item.componentId}:${item.category}:${item.ruleText}`;
        assert.equals(item.id, expectedId, 'Item ID should follow the expected format');
      });
    });
  }
};
