// packages/core/src/__tests__/StateRegistry.test.js

import { StateRegistry } from '../registry/StateRegistry.js';

describe('StateRegistry', () => {
  describe('Auto-discovery strategy', () => {
    it('should extract short names from class names', () => {
      const registry = new StateRegistry({
        stateRegistry: {
          strategy: 'auto',
          statusPrefixes: ['Accepted', 'Rejected', 'Pending']
        }
      });
      
      const discoveryResult = {
        files: {
          implications: [
            { metadata: { className: 'AcceptedBookingImplications' } },
            { metadata: { className: 'RejectedBookingImplications' } },
            { metadata: { className: 'PendingBookingImplications' } }
          ]
        }
      };
      
      registry.build(discoveryResult);
      
      expect(registry.size).toBe(3);
      expect(registry.resolve('accepted')).toBe('AcceptedBookingImplications');
      expect(registry.resolve('rejected')).toBe('RejectedBookingImplications');
      expect(registry.resolve('pending')).toBe('PendingBookingImplications');
    });
    
    it('should handle case-insensitive resolution', () => {
      const registry = new StateRegistry({
        stateRegistry: {
          strategy: 'auto',
          caseSensitive: false
        }
      });
      
      const discoveryResult = {
        files: {
          implications: [
            { metadata: { className: 'AcceptedBookingImplications' } }
          ]
        }
      };
      
      registry.build(discoveryResult);
      
      expect(registry.resolve('accepted')).toBe('AcceptedBookingImplications');
      expect(registry.resolve('Accepted')).toBe('AcceptedBookingImplications');
      expect(registry.resolve('ACCEPTED')).toBe('AcceptedBookingImplications');
    });
    
    it('should resolve full class names without registry lookup', () => {
      const registry = new StateRegistry({
        stateRegistry: { strategy: 'auto' }
      });
      
      const discoveryResult = {
        files: {
          implications: [
            { metadata: { className: 'AcceptedBookingImplications' } }
          ]
        }
      };
      
      registry.build(discoveryResult);
      
      expect(registry.resolve('AcceptedBookingImplications'))
        .toBe('AcceptedBookingImplications');
    });
  });
  
  describe('Pattern-based strategy', () => {
    it('should extract states using pattern', () => {
      const registry = new StateRegistry({
        stateRegistry: {
          strategy: 'pattern',
          pattern: '{Status}BookingImplications'
        }
      });
      
      const discoveryResult = {
        files: {
          implications: [
            { metadata: { className: 'AcceptedBookingImplications' } },
            { metadata: { className: 'RejectedBookingImplications' } },
            { metadata: { className: 'SomeOtherClass' } } // Should be ignored
          ]
        }
      };
      
      registry.build(discoveryResult);
      
      expect(registry.size).toBe(2);
      expect(registry.resolve('accepted')).toBe('AcceptedBookingImplications');
      expect(registry.resolve('rejected')).toBe('RejectedBookingImplications');
      expect(registry.resolve('someother')).toBeNull();
    });
    
    it('should throw error if pattern not provided', () => {
      const registry = new StateRegistry({
        stateRegistry: { strategy: 'pattern' }
      });
      
      expect(() => registry.build({ files: { implications: [] } }))
        .toThrow('Pattern strategy requires stateRegistry.pattern in config');
    });
  });
  
  describe('Explicit mappings strategy', () => {
    it('should use explicit mappings from config', () => {
      const registry = new StateRegistry({
        stateRegistry: {
          strategy: 'explicit',
          mappings: {
            'accepted': 'AcceptedBookingImplications',
            'rejected': 'RejectedBookingImplications',
            'custom_state': 'MyCustomStateClass'
          }
        }
      });
      
      registry.build({ files: { implications: [] } });
      
      expect(registry.size).toBe(3);
      expect(registry.resolve('accepted')).toBe('AcceptedBookingImplications');
      expect(registry.resolve('custom_state')).toBe('MyCustomStateClass');
      expect(registry.resolve('pending')).toBeNull();
    });
  });
  
  describe('Registry operations', () => {
    let registry;
    
    beforeEach(() => {
      registry = new StateRegistry({
        stateRegistry: {
          strategy: 'explicit',
          mappings: {
            'accepted': 'AcceptedBookingImplications',
            'rejected': 'RejectedBookingImplications'
          }
        }
      });
      registry.build({ files: { implications: [] } });
    });
    
    it('should check if state exists', () => {
      expect(registry.exists('accepted')).toBe(true);
      expect(registry.exists('pending')).toBe(false);
    });
    
    it('should get short name from full class name', () => {
      expect(registry.getShortName('AcceptedBookingImplications'))
        .toBe('accepted');
    });
    
    it('should get all mappings', () => {
      const mappings = registry.getAllMappings();
      expect(mappings).toHaveLength(2);
      expect(mappings[0]).toEqual({
        shortName: 'accepted',
        fullClassName: 'AcceptedBookingImplications'
      });
    });
    
    it('should serialize to JSON', () => {
      const json = registry.toJSON();
      expect(json.strategy).toBe('explicit');
      expect(json.size).toBe(2);
      expect(json.mappings).toHaveLength(2);
    });
    
    it('should clear all mappings', () => {
      registry.clear();
      expect(registry.size).toBe(0);
      expect(registry.exists('accepted')).toBe(false);
    });
  });
  
  describe('Edge cases', () => {
    it('should handle null/undefined state names', () => {
      const registry = new StateRegistry({});
      expect(registry.resolve(null)).toBeNull();
      expect(registry.resolve(undefined)).toBeNull();
      expect(registry.resolve('')).toBeNull();
    });
    
    it('should warn on naming conflicts', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const registry = new StateRegistry({
        stateRegistry: { strategy: 'auto' }
      });
      
      registry.register('accepted', 'AcceptedBookingImplications');
      registry.register('accepted', 'AcceptedApplicationImplications');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('State name conflict')
      );
      
      consoleSpy.mockRestore();
    });
    
    it('should handle missing discovery data gracefully', () => {
      const registry = new StateRegistry({
        stateRegistry: { strategy: 'auto' }
      });
      
      expect(() => registry.build({})).not.toThrow();
      expect(() => registry.build({ files: {} })).not.toThrow();
      expect(() => registry.build({ files: { implications: null } })).not.toThrow();
    });
  });
});