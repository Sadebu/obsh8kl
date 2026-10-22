import React, { useState, useEffect, useCallback } from 'react';
import { stations, miniGames, teacherKeys } from './data/gameData';

type Screen = 'welcome' | 'station' | 'minigame' | 'summary' | 'diagnosis' | 'teacher';

interface StudentResult {
  name: string;
  startTime: number;
  endTime: number;
  stationScores: Record<number, number>;
  miniGameScores: Record<string, number>;
  totalScore: number;
  grade: string;
  comments?: string;
  teacherApproved?: boolean;
}

function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [studentName, setStudentName] = useState('');
  const [currentStation, setCurrentStation] = useState(0);
  const [stationPhase, setStationPhase] = useState<'narrative' | 'question' | 'feedback'>('narrative');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [stationScores, setStationScores] = useState<Record<number, number>>({});
  const [miniGameScores, setMiniGameScores] = useState<Record<string, number>>({});
  const [currentMiniGame, setCurrentMiniGame] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [teacherAuth, setTeacherAuth] = useState(false);
  const [teacherPassword, setTeacherPassword] = useState('');
  const [teacherTab, setTeacherTab] = useState<'journal' | 'keys' | 'aggregate'>('journal');

  // Station flow: narrative -> question -> feedback -> minigame -> summary -> next
  const miniGameOrder = ['timeline', 'match', 'concepts', 'coalitions', 'vienna', 'truefalse'];

  const getMiniGameForStation = (stationIdx: number): string => {
    if (stationIdx < miniGameOrder.length) return miniGameOrder[stationIdx];
    return miniGameOrder[miniGameOrder.length - 1];
  };

  const handleStart = () => {
    if (!studentName.trim()) return;
    setStartTime(Date.now());
    setScreen('station');
    setCurrentStation(0);
    setStationPhase('narrative');
  };

  const handleOptionSelect = (idx: number) => {
    if (stationPhase === 'feedback') return;
    setSelectedOption(idx);
    setStationPhase('feedback');
    const correct = stations[currentStation].options[idx].correct;
    setStationScores(prev => ({
      ...prev,
      [stations[currentStation].id]: correct ? 100 : 30
    }));
  };

  const handleNextStation = () => {
    // Go to mini-game for this station
    const mg = getMiniGameForStation(currentStation);
    setCurrentMiniGame(mg);
    setScreen('minigame');
  };

  const handleMiniGameComplete = (score: number) => {
    const mgId = currentMiniGame!;
    setMiniGameScores(prev => ({ ...prev, [mgId]: score }));
    setScreen('summary');
  };

  const handleNextFromSummary = () => {
    if (currentStation < stations.length - 1) {
      setCurrentStation(prev => prev + 1);
      setStationPhase('narrative');
      setSelectedOption(null);
      setScreen('station');
    } else {
      setScreen('diagnosis');
    }
  };

  const getGrade = (score: number): string => {
    if (score >= 85) return '5';
    if (score >= 70) return '4';
    if (score >= 50) return '3';
    return '2';
  };

  const getTotalScore = (): number => {
    const stationValues = Object.values(stationScores);
    const miniValues = Object.values(miniGameScores);
    const all = [...stationValues, ...miniValues];
    if (all.length === 0) return 0;
    return Math.round(all.reduce((a, b) => a + b, 0) / all.length);
  };

  const saveResult = useCallback(() => {
    const result: StudentResult = {
      name: studentName,
      startTime,
      endTime: Date.now(),
      stationScores,
      miniGameScores,
      totalScore: getTotalScore(),
      grade: getGrade(getTotalScore())
    };
    const existing = JSON.parse(localStorage.getItem('historyQuest_results') || '[]');
    existing.push(result);
    localStorage.setItem('historyQuest_results', JSON.stringify(existing));
  }, [studentName, startTime, stationScores, miniGameScores]);

  useEffect(() => {
    if (screen === 'diagnosis') {
      saveResult();
    }
  }, [screen, saveResult]);

  // Render
  if (screen === 'welcome') {
    return <WelcomeScreen name={studentName} setName={setStudentName} onStart={handleStart} onTeacher={() => setScreen('teacher')} />;
  }

  if (screen === 'teacher') {
    return (
      <TeacherScreen
        auth={teacherAuth}
        password={teacherPassword}
        setPassword={setTeacherPassword}
        onAuth={() => {
          if (teacherPassword === 'teacher123') {
            setTeacherAuth(true);
          } else {
            alert('Неверный пароль');
          }
        }}
        tab={teacherTab}
        setTab={setTeacherTab}
        onBack={() => { setScreen('welcome'); setTeacherAuth(false); setTeacherPassword(''); }}
      />
    );
  }

  if (screen === 'diagnosis') {
    return (
      <DiagnosisScreen
        stationScores={stationScores}
        miniGameScores={miniGameScores}
        totalScore={getTotalScore()}
        grade={getGrade(getTotalScore())}
        onRestart={() => {
          setScreen('welcome');
          setStudentName('');
          setCurrentStation(0);
          setStationPhase('narrative');
          setSelectedOption(null);
          setStationScores({});
          setMiniGameScores({});
        }}
      />
    );
  }

  if (screen === 'minigame' && currentMiniGame) {
    return (
      <div className="app-container">
        <Header title="Мини-игра" progress={`${currentStation + 1}/${stations.length}`} onBack={() => setScreen('summary')} />
        <div className="main-content">
          <MiniGameComponent gameId={currentMiniGame} onComplete={handleMiniGameComplete} />
        </div>
      </div>
    );
  }

  if (screen === 'summary') {
    return (
      <div className="app-container">
        <Header title="Что повторили" progress={`${currentStation + 1}/${stations.length}`} />
        <div className="main-content">
          <SummaryCard station={stations[currentStation]} />
          <div className="nav-buttons">
            <button className="btn btn-primary" onClick={handleNextFromSummary}>
              {currentStation < stations.length - 1 ? 'Следующая станция →' : 'Итоговая диагностика →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Station screen
  const station = stations[currentStation];
  return (
    <div className="app-container">
      <Header title={`Станция ${station.id}`} progress={`${currentStation + 1}/${stations.length}`} />
      <div className="main-content">
        <div className="station-screen">
          <div className="station-header">
            <div className="station-number">Станция {station.id} • {station.paragraphs}</div>
            <div className="station-title">{station.title}</div>
            <div className="station-period">{station.period}</div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${((currentStation + 1) / stations.length) * 100}%` }} />
            </div>
          </div>

          {stationPhase === 'narrative' && (
            <>
              <div className="station-narrative">
                {station.narrative.map((p, i) => <p key={i}>{p}</p>)}
              </div>
              <div className="nav-buttons">
                <button className="btn btn-primary" onClick={() => setStationPhase('question')}>
                  Сделать выбор →
                </button>
              </div>
            </>
          )}

          {stationPhase === 'question' && (
            <div className="choice-section">
              <div className="choice-question">{station.question}</div>
              <div className="choice-options">
                {station.options.map((opt, idx) => (
                  <div
                    key={idx}
                    className={`choice-option ${selectedOption === idx ? 'selected' : ''}`}
                    onClick={() => handleOptionSelect(idx)}
                  >
                    {opt.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {stationPhase === 'feedback' && selectedOption !== null && (
            <>
              <div className="choice-section">
                <div className="choice-question">{station.question}</div>
                <div className="choice-options">
                  {station.options.map((opt, idx) => (
                    <div
                      key={idx}
                      className={`choice-option ${idx === selectedOption ? (opt.correct ? 'correct' : 'incorrect') : (opt.correct ? 'correct' : '')}`}
                    >
                      {opt.text}
                    </div>
                  ))}
                </div>
              </div>
              <div className={`feedback-box ${station.options[selectedOption].correct ? 'feedback-correct' : 'feedback-incorrect'}`}>
                <strong>{station.options[selectedOption].correct ? '✓ Верно!' : '✗ Не совсем...'}</strong>
                <p>{station.options[selectedOption].feedback}</p>
                <p className="feedback-ref">Источник: {station.paragraphs}</p>
              </div>
              <div className="nav-buttons">
                <button className="btn btn-primary" onClick={handleNextStation}>
                  Мини-игра →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// === COMPONENTS ===

function Header({ title, progress, onBack }: { title: string; progress: string; onBack?: () => void }) {
  return (
    <div className="header">
      <div>
        <div className="header-title">{title}</div>
        <div className="header-progress">{progress}</div>
      </div>
      {onBack && <button className="header-btn" onClick={onBack}>← Назад</button>}
    </div>
  );
}

function WelcomeScreen({ name, setName, onStart, onTeacher }: { name: string; setName: (n: string) => void; onStart: () => void; onTeacher: () => void }) {
  return (
    <div className="app-container">
      <div className="welcome-screen">
        <div className="welcome-title">🏛️ Эпоха Революции</div>
        <div className="welcome-subtitle">
          Сюжетный квест по Всеобщей истории 8 класса §16–22.<br />
          Французская революция и наполеоновская эпоха (1789–1815).<br />
          6 станций, мини-игры, обобщающие карточки. Время: 40–45 минут.
        </div>
        <div className="welcome-form">
          <input
            className="welcome-input"
            type="text"
            placeholder="Введите ваше имя и фамилию"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onStart()}
          />
          <button className="btn btn-primary" onClick={onStart} disabled={!name.trim()}>
            Начать квест
          </button>
          <button className="btn btn-outline btn-small" onClick={onTeacher}>
            Страница учителя
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ station }: { station: typeof stations[0] }) {
  return (
    <div className="summary-card">
      <h3>📋 Что повторили: {station.title}</h3>

      <div className="summary-section">
        <h4>📅 Лента дат</h4>
        <div className="dates-timeline">
          {station.summary.dates.map((d, i) => (
            <span key={i} className="date-badge">{d}</span>
          ))}
        </div>
      </div>

      <div className="summary-section">
        <h4>📖 Ключевые понятия</h4>
        <ul className="concepts-list">
          {station.summary.concepts.map((c, i) => (
            <li key={i}><span className="concept-term">{c.term}</span> — {c.definition}</li>
          ))}
        </ul>
      </div>

      <div className="summary-section">
        <h4>⚡ Причинно-следственная связь</h4>
        <div className="cause-effect">{station.summary.causeEffect}</div>
      </div>

      <div className="summary-section">
        <h4>🔗 Вопрос на связь с предыдущей станцией</h4>
        <div className="connection-question">{station.summary.connectionQuestion}</div>
      </div>
    </div>
  );
}

// === MINI GAMES ===

function MiniGameComponent({ gameId, onComplete }: { gameId: string; onComplete: (score: number) => void }) {
  switch (gameId) {
    case 'timeline': return <TimelineGame onComplete={onComplete} />;
    case 'match': return <MatchGame data={miniGames.match as any} onComplete={onComplete} />;
    case 'concepts': return <MatchGame data={miniGames.concepts as any} onComplete={onComplete} />;
    case 'coalitions': return <DistributionGame data={miniGames.coalitions} onComplete={onComplete} />;
    case 'vienna': return <DistributionGame data={miniGames.vienna} onComplete={onComplete} />;
    case 'truefalse': return <TrueFalseGame onComplete={onComplete} />;
    default: return <div>Игра не найдена</div>;
  }
}

function TimelineGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [items, setItems] = useState(() => {
    const shuffled = [...miniGames.timeline.events].sort(() => Math.random() - 0.5);
    return shuffled;
  });
  const [submitted, setSubmitted] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const moveItem = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const newItems = [...items];
    [newItems[idx], newItems[newIdx]] = [newItems[newIdx], newItems[idx]];
    setItems(newItems);
  };

  const checkOrder = () => {
    setSubmitted(true);
    const correctCount = items.filter((item, idx) => item.order === idx + 1).length;
    const score = Math.round((correctCount / items.length) * 100);
    setFinalScore(score);
  };

  return (
    <div className="minigame-container">
      <div className="minigame-title">{miniGames.timeline.title}</div>
      <div className="minigame-desc">{miniGames.timeline.description}</div>

      <div className="timeline-items">
        {items.map((item, idx) => (
          <div key={item.id} className={`timeline-item ${submitted ? (item.order === idx + 1 ? 'correct' : 'incorrect') : ''}`}>
            <div className="timeline-arrows">
              <button className="arrow-btn" onClick={() => moveItem(idx, -1)} disabled={submitted}>↑</button>
              <button className="arrow-btn" onClick={() => moveItem(idx, 1)} disabled={submitted}>↓</button>
            </div>
            <span>{item.text}</span>
            {submitted && <span style={{ marginLeft: 'auto', fontSize: '0.8rem', fontWeight: 700 }}>{item.year}</span>}
          </div>
        ))}
      </div>

      {!submitted ? (
        <button className="btn btn-primary" onClick={checkOrder}>Проверить порядок</button>
      ) : (
        <div>
          <p style={{ marginBottom: 10, fontWeight: 600, color: 'var(--primary)' }}>Результат: {finalScore}%</p>
          <button className="btn btn-primary" onClick={() => finalScore !== null && onComplete(finalScore)}>Продолжить →</button>
        </div>
      )}
    </div>
  );
}

function MatchGame({ data, onComplete }: { data: { title: string; description: string; pairs: { [key: string]: string }[] } | typeof miniGames.match | typeof miniGames.concepts; onComplete: (score: number) => void }) {
  const pairs = (data as any).pairs as { [key: string]: string }[];
  const leftKey = pairs[0] && 'person' in pairs[0] ? 'person' : 'term';
  const rightKey = pairs[0] && 'role' in pairs[0] ? 'role' : 'definition';
  const leftLabel = leftKey === 'person' ? 'Деятель' : 'Термин';
  const rightLabel = rightKey === 'role' ? 'Роль и судьба' : 'Определение';

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, string>>({});
  const [wrongPair, setWrongPair] = useState<{ left: string; right: string } | null>(null);
  const [shuffledRight] = useState(() => [...pairs.map(p => p[rightKey])].sort(() => Math.random() - 0.5));

  useEffect(() => {
    if (selectedLeft && selectedRight) {
      const pair = pairs.find(p => p[leftKey] === selectedLeft);
      if (pair && pair[rightKey] === selectedRight) {
        setMatched(prev => ({ ...prev, [selectedLeft]: selectedRight }));
        setWrongPair(null);
      } else {
        setWrongPair({ left: selectedLeft, right: selectedRight });
        setTimeout(() => setWrongPair(null), 1000);
      }
      setSelectedLeft(null);
      setSelectedRight(null);
    }
  }, [selectedLeft, selectedRight, pairs, leftKey, rightKey]);

  useEffect(() => {
    if (Object.keys(matched).length === pairs.length) {
      setTimeout(() => onComplete(100), 500);
    }
  }, [matched, pairs.length, onComplete]);

  return (
    <div className="minigame-container">
      <div className="minigame-title">{(data as any).title}</div>
      <div className="minigame-desc">{(data as any).description}</div>
      <div className="minigame-score">Совпадений: {Object.keys(matched).length} / {pairs.length}</div>

      <div className="match-container">
        <div className="match-column">
          <div className="match-column-title">{leftLabel}</div>
          {pairs.map((p, i) => {
            const leftVal = p[leftKey];
            return (
              <div
                key={i}
                className={`match-item ${matched[leftVal] ? 'matched' : ''} ${selectedLeft === leftVal ? 'selected' : ''} ${wrongPair?.left === leftVal ? 'wrong' : ''}`}
                onClick={() => !matched[leftVal] && setSelectedLeft(leftVal)}
              >
                {leftVal}
              </div>
            );
          })}
        </div>
        <div className="match-column">
          <div className="match-column-title">{rightLabel}</div>
          {shuffledRight.map((rightVal, i) => {
            const isMatched = Object.values(matched).includes(rightVal);
            return (
              <div
                key={i}
                className={`match-item ${isMatched ? 'matched' : ''} ${selectedRight === rightVal ? 'selected' : ''} ${wrongPair?.right === rightVal ? 'wrong' : ''}`}
                onClick={() => !isMatched && setSelectedRight(rightVal)}
              >
                {rightVal}
              </div>
            );
          })}
        </div>
      </div>

      {Object.keys(matched).length === pairs.length && (
        <div style={{ marginTop: 15 }}>
          <button className="btn btn-primary" onClick={() => onComplete(100)}>Продолжить →</button>
        </div>
      )}
    </div>
  );
}

function DistributionGame({ data, onComplete }: { data: typeof miniGames.coalitions; onComplete: (score: number) => void }) {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const handlePlace = (categoryName: string) => {
    if (!selectedItem || submitted) return;
    setPlacements(prev => ({ ...prev, [selectedItem]: categoryName }));
    setSelectedItem(null);
  };

  const checkAnswers = () => {
    setSubmitted(true);
    let correct = 0;
    data.categories.forEach(cat => {
      data.allItems.forEach(item => {
        if (placements[item] === cat.name && cat.items.includes(item)) correct++;
      });
    });
    const total = data.allItems.length;
    const score = Math.round((correct / total) * 100);
    setFinalScore(score);
  };

  const getCorrectCategory = (item: string): string => {
    for (const cat of data.categories) {
      if (cat.items.includes(item)) return cat.name;
    }
    return '';
  };

  return (
    <div className="minigame-container">
      <div className="minigame-title">{data.title}</div>
      <div className="minigame-desc">{data.description}</div>

      <div className="dist-pool">
        {data.allItems.map(item => (
          <div
            key={item}
            className={`dist-pool-item ${placements[item] ? 'used' : ''} ${selectedItem === item ? 'selected' : ''}`}
            onClick={() => !placements[item] && setSelectedItem(item === selectedItem ? null : item)}
          >
            {item}
          </div>
        ))}
      </div>

      <div className="dist-categories">
        {data.categories.map(cat => (
          <div key={cat.name} className="dist-category">
            <div className="dist-category-title">{cat.name}</div>
            <div className="dist-items" onClick={() => handlePlace(cat.name)}>
              {data.allItems.filter(item => placements[item] === cat.name).map(item => {
                const isCorrect = cat.items.includes(item);
                return (
                  <div key={item} className={`dist-item ${submitted ? (isCorrect ? 'placed' : 'wrong') : ''}`}>
                    {item} {submitted && !isCorrect && <span style={{ color: 'var(--error)', fontSize: '0.75rem' }}> ← {getCorrectCategory(item)}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!submitted ? (
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: 8 }}>
            Размещено: {Object.keys(placements).length} из {data.allItems.length}
          </p>
          <button className="btn btn-primary" onClick={checkAnswers}>
            Проверить
          </button>
        </div>
      ) : (
        <div>
          <p style={{ marginBottom: 10, fontWeight: 600, color: 'var(--primary)' }}>Результат: {finalScore}%</p>
          <button className="btn btn-primary" onClick={() => finalScore !== null && onComplete(finalScore)}>Продолжить →</button>
        </div>
      )}
    </div>
  );
}

function TrueFalseGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [answers, setAnswers] = useState<Record<number, boolean | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const setAnswer = (idx: number, val: boolean) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [idx]: val }));
  };

  const check = () => {
    setSubmitted(true);
    let correct = 0;
    miniGames.truefalse.statements.forEach((s, i) => {
      if (answers[i] === s.truth) correct++;
    });
    const score = Math.round((correct / miniGames.truefalse.statements.length) * 100);
    setFinalScore(score);
  };

  return (
    <div className="minigame-container">
      <div className="minigame-title">{miniGames.truefalse.title}</div>
      <div className="minigame-desc">{miniGames.truefalse.description}</div>

      {miniGames.truefalse.statements.map((s, i) => (
        <div key={i} className="tf-item">
          <div>{s.text}</div>
          <div className="tf-buttons">
            <button
              className={`tf-btn ${answers[i] === true ? 'active-true' : ''}`}
              onClick={() => setAnswer(i, true)}
            >
              ✓ Факт
            </button>
            <button
              className={`tf-btn ${answers[i] === false ? 'active-false' : ''}`}
              onClick={() => setAnswer(i, false)}
            >
              ✗ Миф
            </button>
          </div>
          {submitted && (
            <div style={{ marginTop: 8, fontSize: '0.85rem', color: answers[i] === s.truth ? 'var(--success)' : 'var(--error)' }}>
              {answers[i] === s.truth ? '✓ Верно!' : `✗ Это ${s.truth ? 'факт' : 'миф'}.`} {s.explanation}
            </div>
          )}
        </div>
      ))}

      {!submitted ? (
        <button className="btn btn-primary" onClick={check} disabled={Object.keys(answers).length < miniGames.truefalse.statements.length}>
          Проверить
        </button>
      ) : (
        <div>
          <p style={{ marginBottom: 10, fontWeight: 600, color: 'var(--primary)' }}>Результат: {finalScore}%</p>
          <button className="btn btn-primary" onClick={() => finalScore !== null && onComplete(finalScore)}>Продолжить →</button>
        </div>
      )}
    </div>
  );
}

// === DIAGNOSIS ===

function DiagnosisScreen({ stationScores, miniGameScores, totalScore, grade, onRestart }: {
  stationScores: Record<number, number>;
  miniGameScores: Record<string, number>;
  totalScore: number;
  grade: string;
  onRestart: () => void;
}) {
  const stationLabels = ['§16', '§17-18', '§19', '§20', '§21-22(1)', '§21-22(2)'];
  const stationIds = [1, 2, 3, 4, 5, 6];
  const scores = stationIds.map(id => stationScores[id] || 0);

  const recommendations: string[] = [];
  stationIds.forEach((id, idx) => {
    if ((stationScores[id] || 0) < 70) {
      recommendations.push(`Перечитать ${stations[idx].paragraphs} «${stations[idx].title}» — результат ${(stationScores[id] || 0)}%`);
    }
  });

  const allConcepts = stations.flatMap(s => s.summary.concepts.map(c => c.term));
  const masteredCount = Math.round((totalScore / 100) * allConcepts.length);

  return (
    <div className="app-container">
      <Header title="Итоги повторения" progress="Завершено" />
      <div className="main-content diagnosis-screen">
        <div className="diagnosis-header">
          <h2>📊 Итоги повторения</h2>
          <p>Французская революция и наполеоновская эпоха (1789–1815)</p>
        </div>

        <div className="diagnosis-chart">
          <h3>Результаты по параграфам</h3>
          <div className="chart-container">
            <svg width="100%" height="220" viewBox="0 0 600 220" preserveAspectRatio="xMidYMid meet">
              {scores.map((score, i) => {
                const barWidth = 60;
                const gap = (600 - barWidth * 6) / 7;
                const x = gap + i * (barWidth + gap);
                const barHeight = (score / 100) * 160;
                const y = 180 - barHeight;
                const color = score >= 85 ? '#2e7d32' : score >= 70 ? '#1565c0' : score >= 50 ? '#f57f17' : '#c62828';
                return (
                  <g key={i}>
                    <rect x={x} y={y} width={barWidth} height={barHeight} fill={color} rx="4" />
                    <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fontSize="12" fontWeight="700" fill={color}>{score}%</text>
                    <text x={x + barWidth / 2} y={200} textAnchor="middle" fontSize="11" fill="#616161">{stationLabels[i]}</text>
                  </g>
                );
              })}
              <line x1="0" y1="180" x2="600" y2="180" stroke="#e0e0e0" strokeWidth="2" />
            </svg>
          </div>
        </div>

        <div className="diagnosis-grade">
          <p>Общий результат: <strong>{totalScore}%</strong></p>
          <div className={`grade-display grade-${grade}`}>{grade}</div>
          <p style={{ color: 'var(--text-light)' }}>
            {grade === '5' && 'Отлично! Вы прекрасно знаете материал эпохи.'}
            {grade === '4' && 'Хорошо! Есть небольшие пробелы, но основа крепкая.'}
            {grade === '3' && 'Удовлетворительно. Рекомендуется повторить отдельные параграфы.'}
            {grade === '2' && 'Нужно серьёзно повторить материал. Не отчаивайтесь!'}
          </p>
        </div>

        {recommendations.length > 0 && (
          <div className="diagnosis-recommendations">
            <h3>📝 Рекомендации</h3>
            {recommendations.map((r, i) => (
              <div key={i} className="recommendation-item">{r}</div>
            ))}
          </div>
        )}

        <div className="concepts-mastered">
          <h3>📚 Понятия ({masteredCount} из {allConcepts.length} предположительно освоено)</h3>
          <div className="mastered-tags">
            {allConcepts.slice(0, Math.min(masteredCount, allConcepts.length)).map((c, i) => (
              <span key={i} className="mastered-tag yes">{c}</span>
            ))}
            {allConcepts.slice(masteredCount).map((c, i) => (
              <span key={i} className="mastered-tag no">{c}</span>
            ))}
          </div>
        </div>

        <div className="nav-buttons">
          <button className="btn btn-primary" onClick={onRestart}>Пройти заново</button>
        </div>
      </div>
    </div>
  );
}

// === TEACHER PAGE ===

function TeacherScreen({ auth, password, setPassword, onAuth, tab, setTab, onBack }: {
  auth: boolean;
  password: string;
  setPassword: (p: string) => void;
  onAuth: () => void;
  tab: string;
  setTab: (t: 'journal' | 'keys' | 'aggregate') => void;
  onBack: () => void;
}) {
  if (!auth) {
    return (
      <div className="app-container">
        <Header title="Страница учителя" progress="" onBack={onBack} />
        <div className="main-content">
          <div className="teacher-login">
            <h2>🔐 Вход для учителя</h2>
            <input
              className="welcome-input"
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onAuth()}
            />
            <button className="btn btn-primary" onClick={onAuth}>Войти</button>
          </div>
        </div>
      </div>
    );
  }

  const results: StudentResult[] = JSON.parse(localStorage.getItem('historyQuest_results') || '[]');

  const clearData = () => {
    if (confirm('Удалить все данные учеников?')) {
      localStorage.removeItem('historyQuest_results');
      alert('Данные удалены');
    }
  };

  const exportCSV = () => {
    let csv = 'Имя;Время;Станция1;Станция2;Станция3;Станция4;Станция5;Станция6;Мини-игры;Итого;Оценка\n';
    results.forEach(r => {
      csv += `${r.name};${new Date(r.startTime).toLocaleString()};${r.stationScores[1] || 0}%;${r.stationScores[2] || 0}%;${r.stationScores[3] || 0}%;${r.stationScores[4] || 0}%;${r.stationScores[5] || 0}%;${r.stationScores[6] || 0}%;${Object.values(r.miniGameScores).join(', ')};${r.totalScore}%;${r.grade}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'history_quest_results.csv';
    a.click();
  };

  const exportTXT = () => {
    let txt = 'ЖУРНАЛ РЕЗУЛЬТАТОВ — Эпоха Революции\n' + '='.repeat(50) + '\n\n';
    results.forEach(r => {
      txt += `Ученик: ${r.name}\nВремя: ${new Date(r.startTime).toLocaleString()}\n`;
      txt += `Станции: §16=${r.stationScores[1] || 0}%, §17-18=${r.stationScores[2] || 0}%, §19=${r.stationScores[3] || 0}%, §20=${r.stationScores[4] || 0}%, §21-22=${r.stationScores[5] || 0}%/${r.stationScores[6] || 0}%\n`;
      txt += `Итого: ${r.totalScore}%, Оценка: ${r.grade}\n`;
      if (r.comments) txt += `Комментарий: ${r.comments}\n`;
      txt += '-'.repeat(40) + '\n';
    });
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'history_quest_results.txt';
    a.click();
  };

  const updateComment = (idx: number, comment: string) => {
    const updated = [...results];
    updated[idx].comments = comment;
    localStorage.setItem('historyQuest_results', JSON.stringify(updated));
  };

  const toggleApproved = (idx: number) => {
    const updated = [...results];
    updated[idx].teacherApproved = !updated[idx].teacherApproved;
    localStorage.setItem('historyQuest_results', JSON.stringify(updated));
  };

  // Aggregate
  const aggregate = [1, 2, 3, 4, 5, 6].map(id => {
    const vals = results.map(r => r.stationScores[id] || 0).filter(v => v > 0);
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  });

  return (
    <div className="app-container">
      <Header title="Страница учителя" progress={`${results.length} учеников`} onBack={onBack} />
      <div className="main-content teacher-screen">
        <div className="teacher-content">
          <div className="teacher-tabs">
            <div className={`teacher-tab ${tab === 'journal' ? 'active' : ''}`} onClick={() => setTab('journal')}>Журнал</div>
            <div className={`teacher-tab ${tab === 'keys' ? 'active' : ''}`} onClick={() => setTab('keys')}>Ключи</div>
            <div className={`teacher-tab ${tab === 'aggregate' ? 'active' : ''}`} onClick={() => setTab('aggregate')}>Агрегат по классу</div>
          </div>

          {tab === 'journal' && (
            <div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 15, flexWrap: 'wrap' }}>
                <button className="btn btn-small btn-outline" onClick={exportCSV}>Экспорт CSV</button>
                <button className="btn btn-small btn-outline" onClick={exportTXT}>Экспорт TXT</button>
                <button className="btn btn-small btn-secondary" onClick={clearData}>Очистить данные</button>
              </div>

              {results.length === 0 && <p style={{ color: 'var(--text-light)' }}>Пока нет результатов учеников.</p>}

              {results.map((r, idx) => (
                <div key={idx} className="student-card">
                  <div className="student-card-header">
                    <span className="student-name">{r.name}</span>
                    <span className="student-time">{new Date(r.startTime).toLocaleString()}</span>
                  </div>
                  <div className="student-details">
                    Станции: §16={r.stationScores[1] || 0}% | §17-18={r.stationScores[2] || 0}% | §19={r.stationScores[3] || 0}% | §20={r.stationScores[4] || 0}% | §21-22={r.stationScores[5] || 0}%/{r.stationScores[6] || 0}%
                    <br />
                    Итого: {r.totalScore}% → Оценка: <strong>{r.grade}</strong>
                    {r.teacherApproved && ' ✓ Проверено'}
                  </div>
                  <div className="teacher-comment">
                    <textarea
                      placeholder="Комментарий ученику..."
                      value={r.comments || ''}
                      onChange={e => updateComment(idx, e.target.value)}
                    />
                    <button className="btn btn-small btn-outline" style={{ marginTop: 5 }} onClick={() => toggleApproved(idx)}>
                      {r.teacherApproved ? '✓ Проверено' : 'Отметить проверенным'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'keys' && (
            <div className="teacher-panel keys-section">
              <h3>🔑 Эталонные ответы</h3>

              <h4>Станция 1 (§16)</h4>
              <p><strong>Вопрос:</strong> {teacherKeys.station1.question}</p>
              <p><strong>Обоснование:</strong> {teacherKeys.station1.explanation}</p>

              <h4>Станция 2 (§17–18)</h4>
              <p><strong>Вопрос:</strong> {teacherKeys.station2.question}</p>
              <p><strong>Обоснование:</strong> {teacherKeys.station2.explanation}</p>

              <h4>Станция 3 (§19)</h4>
              <p><strong>Вопрос:</strong> {teacherKeys.station3.question}</p>
              <p><strong>Обоснование:</strong> {teacherKeys.station3.explanation}</p>

              <h4>Станция 4 (§20)</h4>
              <p><strong>Вопрос:</strong> {teacherKeys.station4.question}</p>
              <p><strong>Обоснование:</strong> {teacherKeys.station4.explanation}</p>

              <h4>Станция 5 (§21–22)</h4>
              <p><strong>Вопрос:</strong> {teacherKeys.station5.question}</p>
              <p><strong>Обоснование:</strong> {teacherKeys.station5.explanation}</p>

              <h4>Станция 6 (§21–22)</h4>
              <p><strong>Вопрос:</strong> {teacherKeys.station6.question}</p>
              <p><strong>Обоснование:</strong> {teacherKeys.station6.explanation}</p>

              <h4>Мини-игры</h4>
              <p><strong>Лента революции:</strong> {teacherKeys.miniGames.timeline}</p>
              <p><strong>Кто есть кто:</strong> {teacherKeys.miniGames.match}</p>
              <p><strong>Понятийный аппарат:</strong> {teacherKeys.miniGames.concepts}</p>
              <p><strong>Коалиции:</strong> {teacherKeys.miniGames.coalitions}</p>
              <p><strong>Венский конгресс:</strong> {teacherKeys.miniGames.vienna}</p>
              <p><strong>Миф или правда:</strong> {teacherKeys.miniGames.truefalse}</p>
            </div>
          )}

          {tab === 'aggregate' && (
            <div className="teacher-panel">
              <h3>📈 Агрегат по классу (средний % по параграфам)</h3>
              {results.length === 0 && <p style={{ color: 'var(--text-light)' }}>Нет данных.</p>}
              <div className="class-aggregate">
                {aggregate.map((val, i) => (
                  <div key={i} className="aggregate-bar">
                    <div className="aggregate-label">§{[16, '17-18', 19, 20, '21-22', '21-22'][i]}</div>
                    <div className="aggregate-fill">
                      <div className="aggregate-fill-inner" style={{
                        width: `${val}%`,
                        background: val >= 70 ? 'var(--success)' : val >= 50 ? 'var(--warning)' : 'var(--error)'
                      }} />
                    </div>
                    <div className="aggregate-value">{val}%</div>
                  </div>
                ))}
              </div>
              {aggregate.some(v => v > 0 && v < 70) && (
                <div style={{ marginTop: 15 }}>
                  <h4 style={{ color: 'var(--warning)' }}>⚠️ Проседающие параграфы:</h4>
                  {aggregate.map((val, i) => val > 0 && val < 70 && (
                    <div key={i} className="recommendation-item">
                      Класс в среднем набрал {val}% по §{[16, '17-18', 19, 20, '21-22', '21-22'][i]} — рекомендуется повторить на уроке
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
