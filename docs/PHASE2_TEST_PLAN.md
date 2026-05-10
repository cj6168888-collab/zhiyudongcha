# Phase 2 Test Plan

## Objective
Verify Week 2 enhancements: audio visualization, persistent cache, and settings improvements.

## Scope
- Android app
- Background listening service
- UI components

## Test Scenarios

### 1. Audio Visualization
- [ ] Main screen shows audio visualizer panel
- [ ] Start continuous listening - waveform displays in real time
- [ ] Switch between Wave/Bars/Spectrum modes - all render correctly
- [ ] Switch between Green/Blue/Purple color themes - colors apply correctly

### 2. Settings Persistence
- [ ] Visualizer mode persists after app restart
- [ ] Visualizer color persists after app restart
- [ ] vadThreshold value persists after restart
- [ ] micSensitivity value persists after restart
- [ ] Dark mode setting persists
- [ ] Server URLs persist

### 3. Cache Persistence
- [ ] last_energy cache key persists after app restart
- [ ] Cache write/read operations work correctly
- [ ] Cache clearAll() works

### 4. Stability Checks
- [ ] No crashes during normal operation
- [ ] Logging system works correctly
- [ ] Crash handler captures exceptions
- [ ] App restarts after crash (if enabled)

## Manual Testing Steps

### Audio Visualization Test
1. Start app
2. Verify audio visualizer panel appears on main screen
3. Start continuous listening with microphone
4. Observe waveform/bar/spectrum visualization in real time
5. Switch modes in Settings - verify immediate UI update
6. Change color theme - verify colors apply

### Settings Persistence Test
1. Open Settings
2. Switch Visualizer mode (Wave → Bars → Spectrum)
3. Save settings
4. Restart app
5. Verify mode persisted

### Cache Persistence Test
1. Start continuous listening
2. Let it run for a few seconds (energy values cached)
3. Force stop app
4. Restart app
5. Verify last_energy can be read from cache

### Stability Test
1. Use app normally for 5 minutes
2. Check logs for any errors
3. Verify no unexpected crashes

## Automation Considerations
- UI test scaffolding to cover settings changes
- Integration test to simulate offline cache behavior
- Performance test for audio visualization rendering
