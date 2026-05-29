/**
 * Seed bot users so the leaderboard looks populated even with few real players.
 * Runs at server startup; always syncs the bot list (creates missing, renames
 * obsolete-name bots in place to avoid disrupting active challenges).
 */

import { prisma } from '../lib/prisma';
import { getTierFromPoints } from '../constants';

// ── Bot usernames — realistic, social-media style ─────────────────────────────
// Mix of first+last, first+number, lifestyle handles, European names.

const BOT_USERNAMES = [
  // Common first-name style
  'alex_novak', 'martin.kovar', 'petra_kr', 'jan_dvorak', 'lucie_free',
  'tomas.blazek', 'eva_simona', 'filip_urban', 'kate_novotna', 'david_maly',
  'anna_horak', 'ondrej.kral', 'tereza_b', 'michal_vlk', 'klara_vesel',
  'jakub_ruzicka', 'veronika_h', 'adam_pospisil', 'lenka_proch', 'radek_janda',
  'simona_kral', 'stefan_varga', 'jana_mokra', 'roman_stech', 'zuzana_kov',
  'matej_cerny', 'alena_novak', 'pavel_sokol', 'monika_rih', 'richard_fila',
  'barbora_slim', 'lukas_mraz', 'jitka_vesela', 'martin_rak', 'hana_cernak',
  'stanislav_ber', 'marketa_sla', 'vladimir_drab', 'sarka_pech', 'jiri_mach',
  'renata_hol', 'petr_benes', 'irena_klik', 'frantisek_v', 'dagmar_soud',
  'jan_fiala99', 'milan_srb', 'alzbeta_kov', 'jozef_hort', 'kamila_rys',
  // Lifestyle / fitness handles
  'fit_martinK', 'run_petra', 'wellness_tom', 'healthyjan', 'active_lucie',
  'morning_run_m', 'fit_life_ev', 'ironmind_fil', 'kata_fitness', 'david_active',
  'no_scroll_an', 'real_ondra', 'detox.life_t', 'fit_tereza', 'digital_mich',
  'klara_moves', 'lessphone_jak', 'balanced_ver', 'screen_detox_a', 'healthy_lena',
  'radi_runs', 'simon_fit', 'jana_no_scroll', 'roman_health', 'zuzi_active',
  'mat_wellness', 'ale_detox', 'pav_fit', 'moni_run', 'rich_morning',
  'barb_healthy', 'luk_active', 'jit_real', 'mart_fit', 'han_lifestyle',
  // First + number
  'alex99', 'petra_23', 'tomas_01', 'eva_21', 'filip88',
  'kate_12', 'david_77', 'anna_05', 'ondrej_55', 'tereza00',
  'michal_33', 'klara_19', 'jakub_44', 'veronika9', 'adam_66',
  'lenka11', 'radek_88', 'simon_03', 'jana_17', 'roman_42',
  'zuzana_08', 'matej_56', 'alena_34', 'pavel_91', 'monika_27',
  // European names
  'marco_bene', 'luca_romano', 'sofia_cont', 'giulia_mari', 'andrea_ferr',
  'elena_russe', 'ivan_petrov', 'nina_kozlov', 'dmitri_sobol', 'olga_sidorov',
  'lucas_mull', 'emma_schm', 'finn_kohl', 'lena_bauer', 'max_richter',
  'anna_wagne', 'jakob_fisch', 'mia_becker', 'paul_braun', 'lea_kraus',
  'nicolas_martin', 'camille_dup', 'louis_ber', 'chloe_font', 'hugo_simon',
  'marie_clem', 'thomas_ren', 'julie_mor', 'leo_dub', 'alice_lem',
  'james_wils', 'olivia_johns', 'noah_smith', 'emma_jones', 'liam_brow',
  'ava_davis', 'william_mil', 'sophia_wils', 'mason_moor', 'isabella_ta',
  // More realistic variety
  'mikael_berg', 'astrid_hal', 'sven_lind', 'ingrid_ols', 'erik_ande',
  'maja_nils', 'oscar_pers', 'frida_gren', 'axel_holm', 'linnea_ek',
  'andres_garc', 'carmen_mart', 'pablo_lopez', 'lucia_gonz', 'miguel_rod',
  'isabel_fer', 'carlos_sanc', 'ana_perez', 'javier_tor', 'laura_diaz',
  'joao_silv', 'maria_oliv', 'pedro_souz', 'ana_cost', 'lucas_ferr',
  'beatriz_lim', 'gabriel_rod', 'fernanda_al', 'guilherme_s', 'camila_mar',
  'kenji_tanak', 'yuki_sato', 'hiro_suzuk', 'aiko_yamam', 'ryu_nakaму',
  'chan_woo_k', 'soo_jin_l', 'min_jun_p', 'ji_yeon_k', 'hyun_woo_c',
  'priya_sharma', 'arjun_gup', 'ananya_sing', 'rohan_mehta', 'kavya_nair',
  'ali_hassan', 'fatima_ahm', 'omar_khali', 'sara_ibrah', 'youssef_ben',
  // Extra realistic variety
  'real_jan_k', 'actual_pete', 'just_mart', 'im_eva', 'only_tom',
  'normal_fil', 'simple_kat', 'quiet_dav', 'calm_ann', 'steady_ond',
  'focused_ter', 'clear_mich', 'sharp_kla', 'bright_jak', 'bold_ver',
  'swift_ada', 'clean_len', 'pure_rad', 'true_sim', 'free_jan_h',
];

// ── Tier distribution ──────────────────────────────────────────────────────────

const TIERS: { tier: string; weight: number; min: number; max: number }[] = [
  { tier: 'BRONZE',   weight: 30, min: 0,    max: 480   },
  { tier: 'SILVER',   weight: 28, min: 500,  max: 1480  },
  { tier: 'GOLD',     weight: 22, min: 1500, max: 2980  },
  { tier: 'PLATINUM', weight: 13, min: 3000, max: 4950  },
  { tier: 'DIAMOND',  weight: 7,  min: 5000, max: 8500  },
];

function pickTier() {
  const roll = Math.random() * 100;
  let cum = 0;
  for (const t of TIERS) {
    cum += t.weight;
    if (roll < cum) return t;
  }
  return TIERS[0];
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Main seeder ────────────────────────────────────────────────────────────────

export async function seedBots() {
  // Fetch all existing bots
  const existing = await prisma.user.findMany({
    where:  { isBot: true },
    select: { id: true, username: true },
  });

  const existingNames = new Set(existing.map((u) => u.username));
  const targetNames   = new Set(BOT_USERNAMES);

  // ── Rename bots that have old-style names ──────────────────────────────────
  // If a bot's username is NOT in our target list, give it one of the unused
  // target names so the leaderboard looks realistic.
  const unusedTargetNames = BOT_USERNAMES.filter((n) => !existingNames.has(n));
  let renameIdx = 0;
  let renamed   = 0;

  for (const bot of existing) {
    if (targetNames.has(bot.username)) continue;          // already correct
    if (renameIdx >= unusedTargetNames.length) break;     // no names left
    const newName = unusedTargetNames[renameIdx++];
    await prisma.user.update({
      where:  { id: bot.id },
      data:   { username: newName,
                email: `bot_${newName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}@bot.socialess.internal` },
    });
    renamed++;
  }

  // ── Create bots for names not yet in DB ───────────────────────────────────
  // Refresh the name set after renames
  const afterRename = await prisma.user.findMany({
    where:  { isBot: true },
    select: { username: true },
  });
  const afterNames = new Set(afterRename.map((u) => u.username));

  let created = 0;
  for (const username of BOT_USERNAMES) {
    if (afterNames.has(username)) continue;

    const tierInfo   = pickTier();
    const rankPoints = randInt(tierInfo.min, tierInfo.max);
    const tierIndex  = TIERS.indexOf(tierInfo);

    // Higher rank → more games, higher win rate
    const totalGames = randInt(12, 50) * (tierIndex + 1);
    const winRate    = 0.25 + tierIndex * 0.1;
    const wins       = Math.round(totalGames * winRate);
    const losses     = totalGames - wins;

    await prisma.user.create({
      data: {
        email:         `bot_${username.replace(/[^a-z0-9]/gi, '_').toLowerCase()}@bot.socialess.internal`,
        username,
        isBot:         true,
        rankPoints,
        rankTier:      tierInfo.tier as any,
        rankedWins:    wins,
        rankedLosses:  losses,
        level:         randInt(2, 20 + tierIndex * 8),
        currentStreak: 0,
        totalStreak:   randInt(0, 15),
      },
    });
    created++;
  }

  const total = await prisma.user.count({ where: { isBot: true } });
  console.log(
    `[Bots] Seed complete — renamed: ${renamed}, created: ${created}, total: ${total}`,
  );
}
