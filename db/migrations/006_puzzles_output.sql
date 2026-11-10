-- Games and puzzles (word search, crossword, bingo, brain breaks) as a new output type.
alter type output_type add value if not exists 'puzzles';
