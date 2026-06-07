import * as api from './db/api.js';

const app = document.querySelector('#app');
app.innerHTML = `
  <h1>API test panel</h1>
  <button id="run">Run all API tests</button>
  <button id="state">Show current categories</button>
  <pre id="out" style="white-space:pre-wrap;background:#111;color:#0f0;padding:1em;"></pre>
`;

const out = document.querySelector('#out');
const log = (msg) => { out.textContent += msg + '\n'; };
const clear = () => { out.textContent = ''; };

async function runTests() {
  clear();
  const tag = Date.now().toString().slice(-5); // unique per run
  try {
    log('=== addCategory / subcategory ===');
    const movies = await api.addCategory('Movies-' + tag);
    const scifi = await api.addCategory('SciFi-' + tag, movies);
    log(`Movies id=${movies}, SciFi subcategory id=${scifi} (parent ${movies})`);

    log('\n=== addCategoryColumn ===');
    await api.addCategoryColumn(movies, 'director', 'text', 0);
    await api.addCategoryColumn(movies, 'year', 'number', 1);
    log('columns: ' + JSON.stringify(await api.getCategoryColumns(movies)));

    log('\n=== getCategories (visible) ===');
    log(JSON.stringify(await api.getCategories(), null, 1));

    log('\n=== addEntry ===');
    const e1 = await api.addEntry(movies, 'Blade Runner', 8.5, 'great', '1982-06-25',
                                  { director: 'Ridley Scott', year: 1982 });
    const e2 = await api.addEntry(movies, 'Dune', 9, 'epic', '2021-10-22',
                                  { director: 'Denis Villeneuve', year: 2021 });
    log(`entry ids: ${e1}, ${e2}`);

    log('\n=== getCategoryEntries ===');
    log(JSON.stringify(await api.getCategoryEntries(movies), null, 1));

    log('\n=== getEntry(e1) ===');
    log(JSON.stringify(await api.getEntry(e1), null, 1));

    log('\n=== updateEntry: base column (rating 8.5 -> 9.2) ===');
    await api.updateEntry(e1, 'rating', 9.2);
    log('rating now: ' + (await api.getEntry(e1)).rating);

    log('\n=== updateEntry: JSON key (year 1982 -> 1983) ===');
    await api.updateEntry(e1, 'year', 1983);
    log('data now: ' + JSON.stringify((await api.getEntry(e1)).data));

    log('\n=== updateEntry: unknown column (should throw) ===');
    try {
      await api.updateEntry(e1, 'bogus', 'x');
      log('!! ERROR: did not throw');
    } catch (err) {
      log('correctly threw: ' + err.message);
    }

    log('\n=== setCategoryHidden(SciFi) ===');
    await api.setCategoryHidden(scifi, 1);
    const visible = await api.getCategories();
    const all = await api.getCategories(true);
    log(`visible count=${visible.length}, includeHidden count=${all.length} (SciFi hidden)`);

    log('\n=== deleteEntry(e2) ===');
    log('rows deleted: ' + await api.deleteEntry(e2));

    log('\n=== deleteEntries (bulk) ===');
    const e3 = await api.addEntry(movies, 'Arrival', 8, null, '2016-11-11', {});
    const e4 = await api.addEntry(movies, 'Sicario', 7.5, null, '2015-10-02', {});
    log('rows bulk-deleted: ' + await api.deleteEntries([e3, e4]));

    log('\n=== final entries for this category ===');
    log(JSON.stringify(await api.getCategoryEntries(movies), null, 1));
    log('\nALL TESTS RAN.');
  } catch (err) {
    log('\n!! UNEXPECTED ERROR: ' + err.message);
  }
}

async function showState() {
  clear();
  log('All categories (including hidden):');
  log(JSON.stringify(await api.getCategories(true), null, 1));
}

document.querySelector('#run').addEventListener('click', runTests);
document.querySelector('#state').addEventListener('click', showState);