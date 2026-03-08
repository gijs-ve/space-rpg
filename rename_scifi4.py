#!/usr/bin/env python3
"""Fourth pass: fix dot-notation property accesses using old IDs."""
import os, pathlib

BASE = '/Users/gijsbert/Code/rpg'

def patch(path, replacements):
    full = os.path.join(BASE, path)
    with open(full, 'r', encoding='utf-8') as f:
        content = f.read()
    original = content
    for old, new in replacements:
        content = content.replace(old, new)
    if content != original:
        with open(full, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  fixed: {path}')

# Dot-notation property access renames
DOT_RENAMES = [
    # BUILDINGS.*
    ('BUILDINGS.command_center',  'BUILDINGS.great_hall'),
    ('BUILDINGS.hydroponics_bay', 'BUILDINGS.granary'),
    ('BUILDINGS.water_extractor', 'BUILDINGS.millpond'),
    ('BUILDINGS.mining_rig',      'BUILDINGS.quarry'),
    ('BUILDINGS.refinery',        'BUILDINGS.forge'),
    ('BUILDINGS.trade_hub',       'BUILDINGS.marketplace'),
    ('BUILDINGS.recruitment_bay', 'BUILDINGS.barracks'),
    ('BUILDINGS.hangar',          'BUILDINGS.stables'),
    ('BUILDINGS.engineering_bay', 'BUILDINGS.siege_workshop'),
    ('BUILDINGS.defense_grid',    'BUILDINGS.ramparts'),
    # ITEMS.*
    ('ITEMS.medkit',         'ITEMS.herbal_poultice'),
    ('ITEMS.stim_pack',      'ITEMS.war_draught'),
    ('ITEMS.cpu_chip',       'ITEMS.scholars_tome'),
    ('ITEMS.nav_module',     'ITEMS.surveyors_map'),
    ('ITEMS.power_cell',     'ITEMS.holy_relic'),
    ('ITEMS.epsomite',       'ITEMS.gypsum_crystals'),
    ('ITEMS.irarsite',       'ITEMS.iron_ore_seam'),
    ('ITEMS.osmiridium',     'ITEMS.gemstone_cache'),
    ('ITEMS.market_voucher', 'ITEMS.market_bond'),
    # VENDORS.*
    ('VENDORS.deep_horizon', 'VENDORS.wandering_scholar'),
    # ResourceIcon.tsx comment (sprites sheet index)
    ('alloys=3 fuel=4 iridium=5', 'iron=3 wood=4 gold=5'),
    # MapViewport comment
    ('// Refresh tile data so the tile shows as a starbase', '// Refresh tile data so the tile shows as a castle'),
    # hero guide
    ('ITEMS.medkit.name', 'ITEMS.herbal_poultice.name'),
    ('ITEMS.stim_pack.name', 'ITEMS.war_draught.name'),
    # vendors guide
    ('iridium immediately', 'gold immediately'),
    # market guide
    ('ITEMS.market_voucher.name', 'ITEMS.market_bond.name'),
    # Consume comment
    ('// ── Consume (medkit etc.)', '// ── Consume (herbal_poultice etc.)'),
]

client_root = pathlib.Path(os.path.join(BASE, 'client'))
skip_dirs = {'.next', 'node_modules'}
for ts_file in client_root.rglob('*'):
    if ts_file.is_file() and ts_file.suffix in {'.ts', '.tsx'}:
        parts = set(ts_file.relative_to(client_root).parts)
        if parts & skip_dirs:
            continue
        rel = str(ts_file.relative_to(BASE))
        patch(rel, DOT_RENAMES)

# Also fix guide chapters in server (if any)
for p in [
    'server/src/routes/bases.ts',
    'server/src/routes/hero.ts',
    'server/src/routes/vendors.ts',
    'server/src/routes/crafting.ts',
    'server/src/services/base.service.ts',
    'server/src/services/city.service.ts',
]:
    patch(p, DOT_RENAMES)

print('Fourth pass complete.')
