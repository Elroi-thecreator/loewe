const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Loewe Additivity Calculation Engine',
    timestamp: new Date().toISOString()
  });
});

function computeLoeweAdditivity(dA, dB, DA, DB) {
  const numDA = parseFloat(DA);
  const numDB = parseFloat(DB);
  const numDA_combo = parseFloat(dA);
  const numDB_combo = parseFloat(dB);

  if (!numDA || !numDB || numDA <= 0 || numDB <= 0 || isNaN(numDA_combo) || isNaN(numDB_combo)) {
    return null;
  }

  const fracA = numDA_combo / numDA;
  const fracB = numDB_combo / numDB;
  const ci = fracA + fracB;

  let outcome = 'Loewe Additivity';
  let color = '#6366f1';
  let description = 'Pure additive interaction (0.9 ≤ CI ≤ 1.1)';

  if (ci < 0.9) {
    outcome = 'Synergy';
    color = '#10b981';
    description = 'Super-additive synergistic combination (CI < 0.9)';
  } else if (ci > 1.1) {
    outcome = 'Antagonism';
    color = '#f43f5e';
    description = 'Sub-additive antagonistic interaction (CI > 1.1)';
  }

  return {
    dA: numDA_combo,
    dB: numDB_combo,
    DA: numDA,
    DB: numDB,
    fracA: Number(fracA.toFixed(4)),
    fracB: Number(fracB.toFixed(4)),
    ci: Number(ci.toFixed(4)),
    outcome,
    color,
    description
  };
}

app.post('/api/calculate-single', (req, res) => {
  const { dA, dB, DA, DB } = req.body;
  const result = computeLoeweAdditivity(dA, dB, DA, DB);

  if (!result) {
    return res.status(400).json({ error: 'Invalid or missing dose parameters.' });
  }

  res.json(result);
});

app.post('/api/calculate-batch', (req, res) => {
  const { items, defaultDA, defaultDB } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Payload must contain a non-empty items array.' });
  }

  let totalCI = 0;
  let countSynergy = 0;
  let countAdditive = 0;
  let countAntagonism = 0;

  const results = items.map((row, index) => {
    const sampleId = row.Sample_ID || row.Sample || `Sample_${index + 1}`;
    const dA = row.Dose_A || row.dA || row.DrugA || 0;
    const dB = row.Dose_B || row.dB || row.DrugB || 0;
    const DA = row.Solo_DA || row.DA || defaultDA || 100;
    const DB = row.Solo_DB || row.DB || defaultDB || 50;

    const calc = computeLoeweAdditivity(dA, dB, DA, DB) || {
      dA: 0, dB: 0, DA: 0, DB: 0, fracA: 0, fracB: 0, ci: 0, outcome: 'Invalid', color: '#94a3b8'
    };

    if (calc.outcome === 'Synergy') countSynergy++;
    else if (calc.outcome === 'Antagonism') countAntagonism++;
    else countAdditive++;

    totalCI += calc.ci;

    return { sampleId, ...calc };
  });

  const avgCI = Number((totalCI / results.length).toFixed(4));

  res.json({
    results,
    summary: {
      total: results.length,
      avgCI,
      countSynergy,
      countAdditive,
      countAntagonism
    }
  });
});

app.listen(PORT, () => {
  console.log(`Loewe Web Service running on port ${PORT}`);
});
