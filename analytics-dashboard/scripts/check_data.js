const mysql = require('mysql2/promise');

(async () => {
  const db = await mysql.createConnection({
    host: 'localhost', port: 3306, user: 'root',
    password: '20020224Ha', database: 'aahaas_marketing'
  });

  console.log('=== CLEANING DATABASE ===\n');

  // 1. Delete ALL post_package_mapping (will be recreated on next import)
  const [delMap] = await db.query('DELETE FROM post_package_mapping');
  console.log(`1. Deleted ${delMap.affectedRows} post_package_mapping rows`);

  // 2. Remove duplicate social_media_posts — keep only the one with lowest id per (source_type, post_id)
  const [dupes] = await db.query(`
    DELETE p FROM social_media_posts p
    INNER JOIN (
      SELECT MIN(id) as keep_id, source_type, post_id
      FROM social_media_posts
      WHERE post_id IS NOT NULL AND post_id != ''
      GROUP BY source_type, post_id
      HAVING COUNT(*) > 1
    ) dup ON p.source_type = dup.source_type AND p.post_id = dup.post_id AND p.id != dup.keep_id
  `);
  console.log(`2. Deleted ${dupes.affectedRows} duplicate posts`);

  // 3. Clear postUrl/fb_permalink/ig_permalink from packages (will be re-set on next import)
  const [pkgs] = await db.query('SELECT id, data FROM pkg_data');
  let cleared = 0;
  for (const pkg of pkgs) {
    const data = typeof pkg.data === 'string' ? JSON.parse(pkg.data) : pkg.data;
    let changed = false;
    for (const key of ['postUrl', 'fb_permalink', 'ig_permalink']) {
      if (data[key]) { delete data[key]; changed = true; }
    }
    // Also clear metrics that came from wrong posts
    for (const key of Object.keys(data)) {
      if (key.startsWith('FB ') || key.startsWith('IG ') || key === 'Combined Reach') {
        delete data[key]; changed = true;
      }
    }
    if (changed) {
      await db.query('UPDATE pkg_data SET data = ? WHERE id = ?', [JSON.stringify(data), pkg.id]);
      cleared++;
    }
  }
  console.log(`3. Cleared postUrl & old metrics from ${cleared} packages`);

  // 4. Delete old import sessions
  const [delSess] = await db.query('DELETE FROM import_sessions');
  console.log(`4. Deleted ${delSess.affectedRows} import sessions`);

  // 5. Show final state
  const [[{postCount}]] = await db.query('SELECT COUNT(*) as postCount FROM social_media_posts');
  const [[{mapCount}]] = await db.query('SELECT COUNT(*) as mapCount FROM post_package_mapping');
  const [[{pkgCount}]] = await db.query('SELECT COUNT(*) as pkgCount FROM pkg_data');
  console.log(`\n=== FINAL STATE ===`);
  console.log(`Posts: ${postCount}, Mappings: ${mapCount}, Packages: ${pkgCount}`);

  // 6. Verify packages
  const [finalPkgs] = await db.query(`
    SELECT id, 
           JSON_UNQUOTE(JSON_EXTRACT(data, '$.Package')) AS pkg_name,
           JSON_UNQUOTE(JSON_EXTRACT(data, '$."Date Published"')) AS date_published
    FROM pkg_data ORDER BY id
  `);
  console.log('\nPackages:');
  finalPkgs.forEach(p => console.log(`  [${p.id}] ${p.pkg_name} | ${p.date_published}`));

  await db.end();
  console.log('\nDone! Ready for re-import.');
})();
