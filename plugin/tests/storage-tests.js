/**
 * Tests for the StorageManager class
 * 
 * Tests storage operations, caching, and data integrity.
 */

const storageTests = {
  name: 'Storage Manager Tests',
  
  setup(runner) {
    // Mock storage for testing
    const mockStorage = {
      cache: {},
      async getAsync(key) {
        return this.cache[key];
      },
      async setAsync(key, value) {
        this.cache[key] = value;
        return true;
      }
    };
    
    // Run before all tests
    runner.beforeAll(async () => {
      // Save original figma client storage
      window._originalClientStorage = figma.clientStorage;
      
      // Replace with mock storage
      figma.clientStorage = mockStorage;
      
      // Create a new storage manager for testing
      window._testStorageManager = new StorageManager();
      await window._testStorageManager.init();
    });
    
    // Run after all tests
    runner.afterAll(() => {
      // Restore original figma client storage
      figma.clientStorage = window._originalClientStorage;
      
      // Clean up test storage manager
      delete window._testStorageManager;
    });
    
    // Basic Initialization Tests
    runner.test('StorageManager should initialize properly', async () => {
      const storageManager = window._testStorageManager;
      
      assert.isTrue(storageManager.initialized, 'StorageManager should be initialized');
      assert.isNotNullOrUndefined(storageManager.cache, 'Cache should be initialized');
      assert.isNotNullOrUndefined(storageManager.cache.checkboxStates, 'Checkbox states should be initialized');
      assert.isNotNullOrUndefined(storageManager.cache.modifiedDates, 'Modified dates should be initialized');
    });
    
    // Basic Get/Set Tests
    runner.test('Should get and set generic values', async () => {
      const storageManager = window._testStorageManager;
      const testKey = 'testKey';
      const testValue = { foo: 'bar' };
      
      // Set value
      await storageManager.set(testKey, testValue);
      
      // Get value from cache
      const cachedValue = storageManager.get(testKey);
      assert.equals(JSON.stringify(cachedValue), JSON.stringify(testValue), 
        'Value should be retrieved from cache');
      
      // Clear cache to test retrieval from storage
      storageManager.cache[testKey] = null;
      
      // Get value from storage
      const storageValue = await storageManager.get(testKey);
      assert.equals(JSON.stringify(storageValue), JSON.stringify(testValue), 
        'Value should be retrieved from storage');
    });
    
    // Default Value Tests
    runner.test('Should return default value when key not found', async () => {
      const storageManager = window._testStorageManager;
      const nonExistentKey = 'nonExistentKey';
      const defaultValue = 'default';
      
      const value = await storageManager.get(nonExistentKey, defaultValue);
      assert.equals(value, defaultValue, 'Should return default value for missing key');
    });
    
    // Checkbox State Tests
    runner.test('Should manage checkbox states correctly', async () => {
      const storageManager = window._testStorageManager;
      const componentId = 'testComponent';
      const category = 'testCategory';
      const ruleText = 'testRule';
      
      // Set state
      await storageManager.setCheckboxState(componentId, category, ruleText, true);
      
      // Get state
      const state = storageManager.getCheckboxState(componentId, category, ruleText);
      assert.isTrue(state && state.checked, 'Checkbox should be checked');
      assert.isNotNullOrUndefined(state && state.timestamp, 'Timestamp should be set');
    });
    
    // Component Score Tests
    runner.test('Should calculate component score correctly', async () => {
      const storageManager = window._testStorageManager;
      const componentId = 'scoreTestComponent';
      const rules = [
        { category: 'cat1', text: 'rule1' },
        { category: 'cat1', text: 'rule2' },
        { category: 'cat2', text: 'rule3' },
        { category: 'cat2', text: 'rule4' },
      ];
      
      // Set some states
      await storageManager.setCheckboxState(componentId, 'cat1', 'rule1', true);
      await storageManager.setCheckboxState(componentId, 'cat2', 'rule3', true);
      
      // Calculate score
      const score = storageManager.calculateComponentScore(componentId, rules);
      
      // 2 out of 4 rules checked
      assert.equals(score, 50, 'Score should be 50% for 2/4 checked rules');
    });
    
    // Flattened Structure Tests
    runner.test('Should migrate to flattened structure correctly', async () => {
      const storageManager = window._testStorageManager;
      const componentId = 'flattenTest';
      const category = 'testCategory';
      const ruleText = 'testRule';
      
      // Start with nested structure
      await storageManager.setCheckboxState(componentId, category, ruleText, true);
      
      // Migrate to flattened structure
      const flatItems = storageManager.migrateToFlatStructure();
      
      // Find the migrated item
      const migratedItem = flatItems.find(item => 
        item.componentId === componentId && 
        item.category === category && 
        item.ruleText === ruleText
      );
      
      assert.isNotNullOrUndefined(migratedItem, 'Item should be migrated to flat structure');
      assert.isTrue(migratedItem.checked, 'Migrated item should preserve checked state');
    });
    
    // Flat Checkbox Operation Tests
    runner.test('Should handle flat checkbox operations correctly', async () => {
      const storageManager = window._testStorageManager;
      
      // Enable flattened structure
      storageManager.setUseFlattenedStructure(true);
      
      const componentId = 'flatOpTest';
      const category = 'testCategory';
      const ruleText = 'testRule';
      
      // Update flat checkbox item
      await storageManager.setCheckboxState(componentId, category, ruleText, true);
      
      // Get items for component
      const items = storageManager.getFlatCheckboxItemsForComponent(componentId);
      assert.isTrue(items.length > 0, 'Should have items for component');
      
      // Find the item
      const item = items.find(i => i.category === category && i.ruleText === ruleText);
      assert.isNotNullOrUndefined(item, 'Item should exist in flat structure');
      assert.isTrue(item.checked, 'Item should be checked');
    });
  }
};
