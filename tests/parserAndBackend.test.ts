import assert from 'node:assert/strict';
import { parseCsvString } from '../src/services/fileImporter.ts';
import {
  markCandidateDuplicates,
  normalizeDigits,
  parseTextBatchToCandidates,
} from '../src/services/transactionParser.ts';

function runParserUnitTests() {
  // 1. Arabic numeral normalization + Arabic SMS parsing
  assert.equal(normalizeDigits('٢٧٥٫٥٠'), '275.50');

  const arabicInput = `تم تحويل مبلغ ٢٥٠.٥٠ جنيه لرقم ٠١٠٩٨٠٧٤٨٨٣ بتاريخ 20 نوفمبر 2026 - 02:35 م رقم العملية 025986446705`;
  const arabicParsed = parseTextBatchToCandidates(arabicInput, 'clipboard');
  assert.equal(arabicParsed.length, 1);
  assert.equal(arabicParsed[0].transactionType, 'send');
  assert.equal(arabicParsed[0].amount, 250.5);
  assert.equal(arabicParsed[0].phoneNumber, '01098074883');
  assert.equal(arabicParsed[0].referenceCode, '025986446705');
  assert.equal(arabicParsed[0].originalSourceText, arabicInput);

  // 2. English receipt text parsing
  const englishInput = `Received EGP 1,450.00 from 01283066049 Ref: VFC-20261120-773120 on 2026-11-20`;
  const englishParsed = parseTextBatchToCandidates(englishInput, 'shared_text');
  assert.equal(englishParsed.length, 1);
  assert.equal(englishParsed[0].transactionType, 'receive');
  assert.equal(englishParsed[0].amount, 1450);
  assert.equal(englishParsed[0].phoneNumber, '01283066049');
  assert.equal(englishParsed[0].referenceCode, 'VFC-20261120-773120');

  // 3. Multi-line batch + duplicate detection
  const multiInput = [
    'تم استلام 500 جنيه من 01038391808 رقم العملية VFC-20261121-111111',
    'تم استلام 500 جنيه من 01038391808 رقم العملية VFC-20261121-111111',
    'سحب من ماكينة ATM بمبلغ 300 جنيه رقم العملية VFC-20261121-222222',
  ].join('\n');

  const multiParsed = markCandidateDuplicates(
    parseTextBatchToCandidates(multiInput, 'clipboard'),
    []
  );
  assert.equal(multiParsed.length, 3);
  assert.equal(multiParsed[0].isDuplicate, false);
  assert.equal(multiParsed[1].isDuplicate, true);
  assert.equal(multiParsed[1].selected, false);
  assert.equal(multiParsed[2].transactionType, 'withdraw');
  assert.equal(multiParsed[2].amount, 300);

  // 4. CSV RFC-4180 parsing (with BOM + quoted commas)
  const csvSample = `\uFEFFamount,phone,type,description\n"1,250.75",01012345678,receive,"تحويل وارد، اختبار"`;
  const matrix = parseCsvString(csvSample);
  assert.equal(matrix.length, 2);
  assert.equal(matrix[0][0], 'amount');
  assert.equal(matrix[1][0], '1,250.75');
  assert.equal(matrix[1][3], 'تحويل وارد، اختبار');

  console.log('ALL PARSER & DUPLICATE UNIT TESTS PASSED (4/4 groups).');
}

runParserUnitTests();
