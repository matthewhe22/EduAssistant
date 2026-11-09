"use client";

import { useMemo, useState } from "react";
import type { PuzzlePack } from "@/lib/generator/schema";
import { buildPuzzles, wordSearchAnswerCells } from "@/lib/puzzles";
import type { ViewProps } from "./LessonPlanView";
import { CurriculumLinksView, Label, List, Panel, Section, Shell, useViewOptions } from "./ui";

/** A square letter grid that prints at a sensible size. */
function LetterGrid({ cols, children, label }: { cols: number; children: React.ReactNode; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="grid w-full select-none font-mono font-bold"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: `${Math.min(560, cols * 44)}px` }}
    >
      {children}
    </div>
  );
}

function NameLine() {
  return <p className="m-0 text-ink-muted">Name: ____________________ &nbsp; Date: ____________</p>;
}

export function PuzzleView({ content: x, ...v }: ViewProps<PuzzlePack>) {
  const { studentCopy, level = "3" } = useViewOptions();
  const [allCards, setAllCards] = useState(false);
  const p = useMemo(() => buildPuzzles(x, level), [x, level]);
  const answerCells = useMemo(() => wordSearchAnswerCells(p.wordSearch), [p.wordSearch]);
  const ws = p.wordSearch;
  const cw = p.crossword;
  const display = new Map(p.entries.map((e) => [e.word, e.display]));
  const fontFor = (n: number) => (n > 12 ? "text-[13px] sm:text-[15px]" : n > 9 ? "text-[15px] sm:text-lg" : "text-lg sm:text-2xl");

  return (
    <Shell title={x.title} {...v}>
      {!studentCopy && (
        <div className="flex flex-col gap-3">
          <p className="m-0 max-w-[64ch] text-ink-soft">{x.overview}</p>
          <CurriculumLinksView links={x.curriculumLinks} codeText={v.codeText} />
        </div>
      )}

      {!studentCopy && (
        <Section title="Words and clues" sectionKey="words">
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full border-collapse text-[15px]">
              <thead>
                <tr className="bg-mist text-left"><th scope="col" className="p-3">Word</th><th scope="col" className="p-3">Clue</th></tr>
              </thead>
              <tbody>
                {x.words.map((w, i) => (
                  <tr key={i} className="border-t border-line align-top">
                    <th scope="row" className="p-3 text-left">{w.word}</th>
                    <td className="p-3">{w.clue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m-0 text-sm text-ink-muted print:hidden">The word search and crossword below are made from these words. Edit the words and they update.</p>
        </Section>
      )}

      <section className="flex break-inside-avoid flex-col gap-4 print:break-before-page" aria-labelledby="ws-heading">
        <h2 id="ws-heading" className="m-0 text-2xl font-bold">Word search{studentCopy ? "" : ": answers shaded"}</h2>
        {studentCopy && <NameLine />}
        <p className="m-0">Find {ws.placed.length} words. They go {ws.directions}.</p>
        <LetterGrid cols={ws.grid.length} label={`Word search, ${ws.grid.length} by ${ws.grid.length} letters`}>
          {ws.grid.flatMap((row, r) =>
            row.map((ch, c) => (
              <span
                key={`${r}-${c}`}
                className={`flex aspect-square items-center justify-center border border-line ${fontFor(ws.grid.length)} ${!studentCopy && answerCells.has(`${r},${c}`) ? "bg-wattle-tint text-ink" : "text-ink"}`}
              >
                {ch}
              </span>
            )),
          )}
        </LetterGrid>
        <ul className="m-0 grid list-none grid-cols-2 gap-x-6 gap-y-1 p-0 text-[17px] sm:grid-cols-3">
          {ws.placed.map((pl) => (
            <li key={pl.word}>☐ {display.get(pl.word) ?? pl.word}</li>
          ))}
        </ul>
      </section>

      {cw.rows > 0 && (
        <section className="flex break-inside-avoid flex-col gap-4 print:break-before-page" aria-labelledby="cw-heading">
          <h2 id="cw-heading" className="m-0 text-2xl font-bold">Crossword{studentCopy ? "" : ": answers"}</h2>
          {studentCopy && <NameLine />}
          <LetterGrid cols={cw.cols} label={`Crossword, ${cw.across.length} across and ${cw.down.length} down`}>
            {cw.cells.flatMap((row, r) =>
              row.map((ch, c) =>
                ch === null ? (
                  <span key={`${r}-${c}`} className="aspect-square" />
                ) : (
                  <span key={`${r}-${c}`} className={`relative flex aspect-square items-center justify-center border border-ink bg-white ${fontFor(cw.cols)} -ml-px -mt-px`}>
                    {cw.numbers[r][c] !== null && <span className="absolute left-0.5 top-0 font-sans text-[9px] font-bold leading-tight sm:text-[11px]">{cw.numbers[r][c]}</span>}
                    {!studentCopy && <span className="text-euc-dark">{ch}</span>}
                  </span>
                ),
              ),
            )}
          </LetterGrid>
          <div className="grid grid-cols-1 gap-5 text-[16px] md:grid-cols-2">
            {(["across", "down"] as const).map((dir) => (
              <div key={dir}>
                <Label>{dir === "across" ? "Across" : "Down"}</Label>
                <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {cw[dir].map((cl) => (
                    <li key={cl.number}>
                      <strong>{cl.number}.</strong> {cl.clue} <span className="text-ink-muted">({cl.length})</span>
                      {!studentCopy && <span className="ml-1.5 font-bold text-euc-dark">{cl.answer}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          {cw.missing.length > 0 && !studentCopy && (
            <p className="m-0 text-sm text-ink-muted">Not in the crossword (no letters to cross with): {cw.missing.map((w) => display.get(w) ?? w).join(", ")}.</p>
          )}
        </section>
      )}

      <Section title="Bingo" sectionKey="bingo">
        <p className="m-0">{x.bingo.instructions}</p>
        {!studentCopy && (
          <Panel tone="wattle">
            <Label tone="wattle">Calling list: read these in any order and tick them off</Label>
            <ol className="m-0 grid grid-cols-1 gap-x-6 gap-y-1 pl-5 text-[15px] md:grid-cols-2">
              {x.bingo.items.map((it, i) => (
                <li key={i}>{it.call} <span className="font-bold text-euc-dark">→ {it.answer}</span></li>
              ))}
            </ol>
          </Panel>
        )}
        {p.bingo.cards.length === 0 ? (
          <p className="m-0 text-ink-muted">Add more bingo items to make the cards (each card needs {p.bingo.size * p.bingo.size} different answers).</p>
        ) : (
          <>
            <p className="m-0 text-sm text-ink-muted print:hidden">
              {p.bingo.cards.length} different cards ({p.bingo.size} × {p.bingo.size}). Printing gives four cards to a page.
              {!allCards && " Showing the first four."}
            </p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {p.bingo.cards.map((card, k) => (
                <div key={k} className={`break-inside-avoid rounded-xl border-2 border-ink p-3 ${k >= 4 && !allCards ? "hidden print:block" : ""} ${k > 0 && k % 4 === 0 ? "print:break-before-page" : ""}`}>
                  <p className="m-0 mb-2 flex justify-between font-display text-lg font-bold">
                    <span>BINGO</span>
                    <span className="font-sans text-sm font-normal text-ink-muted">Card {k + 1}</span>
                  </p>
                  <div className="grid" style={{ gridTemplateColumns: `repeat(${p.bingo.size}, minmax(0, 1fr))` }}>
                    {card.flat().map((a, i) => (
                      <span key={i} className="-ml-px -mt-px flex aspect-square items-center justify-center border border-ink p-1 text-center text-[15px] font-bold leading-tight [overflow-wrap:anywhere]">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {p.bingo.cards.length > 4 && (
              <button type="button" className="btn-outline self-start print:hidden" onClick={() => setAllCards((a) => !a)}>
                {allCards ? "Show fewer cards" : `Show all ${p.bingo.cards.length} cards`}
              </button>
            )}
          </>
        )}
      </Section>

      {!studentCopy && (
        <>
          <Section title="Brain breaks" sectionKey="brainBreaks">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {x.brainBreaks.map((b, i) => (
                <div key={i} className="flex break-inside-avoid flex-col gap-2 rounded-xl border border-line p-4">
                  <p className="m-0 flex items-baseline justify-between gap-2">
                    <strong className="text-lg">{b.name}</strong>
                    <span className="text-sm text-ink-muted">{b.minutes} min</span>
                  </p>
                  <List ordered items={b.steps} />
                  <p className="m-0 text-sm italic text-ink-soft">{b.learningLink}</p>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Teacher notes" sectionKey="teacherNotes" size="sm"><List items={x.teacherNotes} /></Section>
        </>
      )}
    </Shell>
  );
}
