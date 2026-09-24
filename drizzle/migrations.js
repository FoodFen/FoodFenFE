// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_perpetual_the_professor.sql';
import m0001 from './0001_tricky_deadpool.sql';
import m0002 from './0002_good_maddog.sql';
import m0003 from './0003_lame_silverclaw.sql';
import m0004 from './0004_windy_nicolaos.sql';
import m0005 from './0005_legal_omega_red.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005
    }
  }
  