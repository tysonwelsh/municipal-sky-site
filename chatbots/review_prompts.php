<?php
/**
 * Interactive Prompt Review Tool
 * Review each prompt one by one and either accept, reject, or edit it
 * Outputs a CSV file with review status
 */

// Read prompts.json
$prompts_file = __DIR__ . '/prompts.json';
$output_file = __DIR__ . '/reviewed_prompts.csv';

if (!file_exists($prompts_file)) {
    die("Error: prompts.json not found\n");
}

$data = json_decode(file_get_contents($prompts_file), true);
if (!$data || !isset($data['prompts'])) {
    die("Error: Invalid prompts.json format\n");
}

$prompts = $data['prompts'];
$total = count($prompts);

echo "========================================\n";
echo "PROMPT REVIEW TOOL\n";
echo "========================================\n";
echo "Total prompts to review: $total\n\n";
echo "Commands:\n";
echo "  [Enter] = Accept as-is\n";
echo "  r = Reject\n";
echo "  e = Edit text\n";
echo "  q = Quit and save\n";
echo "  s = Skip to prompt number\n";
echo "========================================\n\n";

// Initialize results array
$results = [];

// Check if there's an existing review file to resume from
$start_index = 0;
if (file_exists($output_file)) {
    echo "Found existing review file. Resume from where you left off? (y/n): ";
    $resume = trim(fgets(STDIN));
    if (strtolower($resume) === 'y') {
        $existing = array_map('str_getcsv', file($output_file));
        $start_index = count($existing) - 1; // -1 for header
        if ($start_index < 0)
            $start_index = 0;

        // Load existing results
        foreach ($existing as $i => $row) {
            if ($i === 0)
                continue; // Skip header
            if (count($row) >= 3) {
                $results[] = [
                    'original' => $row[0],
                    'edited' => $row[1],
                    'status' => $row[2]
                ];
            }
        }
        echo "Resuming from prompt " . ($start_index + 1) . "...\n\n";
    }
}

// Review prompts
for ($i = $start_index; $i < $total; $i++) {
    $prompt = $prompts[$i];
    $current = $i + 1;

    // Clear screen (works on most terminals)
    echo "\033[2J\033[H";

    echo "========================================\n";
    echo "Prompt $current of $total\n";
    echo "========================================\n\n";

    // Show the prompt with line wrapping
    echo "PROMPT:\n";
    echo str_repeat("-", 40) . "\n";
    echo wordwrap($prompt, 60) . "\n";
    echo str_repeat("-", 40) . "\n\n";

    // Show some context (what type of prompt this looks like)
    $context = "";
    if (preg_match('/^\d{4}-\d{2}-\d{2}/', $prompt)) {
        $context = "⚠️  Looks like a timestamp";
    } elseif (preg_match('/^\(.*\)$/', $prompt)) {
        $context = "⚠️  Looks like a system message";
    } elseif (preg_match('/^\*.*\*$/', $prompt)) {
        $context = "⚠️  Looks like a meta message";
    } elseif (strlen($prompt) < 5) {
        $context = "⚠️  Very short";
    } elseif (preg_match('/claude|you|i am|are you/i', $prompt)) {
        $context = "⚠️  Contains conversational text";
    } elseif (preg_match('/[a-z]+ [a-z]+/', $prompt)) {
        $context = "✅ Looks like a valid sound prompt";
    }

    if ($context) {
        echo $context . "\n\n";
    }

    echo "Action ([Enter]=Accept, r=Reject, e=Edit, q=Quit, s=Skip to): ";
    $input = trim(fgets(STDIN));

    switch (strtolower($input)) {
        case 'q':
            echo "Quitting and saving...\n";
            saveResults($results, $output_file);
            exit;

        case 'r':
            $results[] = [
                'original' => $prompt,
                'edited' => $prompt,
                'status' => 'rejected'
            ];
            echo "✗ Rejected\n";
            break;

        case 'e':
            echo "Edit prompt (current text will be pre-filled):\n";
            echo "New text: ";
            $edited = trim(fgets(STDIN));
            if (empty($edited)) {
                echo "Empty text, treating as rejected.\n";
                $results[] = [
                    'original' => $prompt,
                    'edited' => $prompt,
                    'status' => 'rejected'
                ];
            } else {
                $results[] = [
                    'original' => $prompt,
                    'edited' => $edited,
                    'status' => 'accepted'
                ];
                echo "✓ Edited and accepted\n";
            }
            break;

        case 's':
            echo "Skip to prompt number (1-$total): ";
            $skip_to = (int) trim(fgets(STDIN));
            if ($skip_to >= 1 && $skip_to <= $total) {
                $i = $skip_to - 2; // -2 because loop will increment
                echo "Skipping to prompt $skip_to...\n";
                continue 2;
            } else {
                echo "Invalid prompt number, continuing...\n";
                $i--; // Redo current prompt
                continue 2;
            }
            break;

        default:
            // Accept as-is
            $results[] = [
                'original' => $prompt,
                'edited' => $prompt,
                'status' => 'accepted'
            ];
            echo "✓ Accepted\n";
            break;
    }

    // Auto-save every 10 prompts
    if (count($results) % 10 === 0) {
        saveResults($results, $output_file);
        echo "Auto-saved progress...\n";
    }

    sleep(1); // Brief pause to see the status
}

echo "\n========================================\n";
echo "REVIEW COMPLETE!\n";
echo "========================================\n";

saveResults($results, $output_file);

// Show summary
$accepted = array_filter($results, function ($r) {
    return $r['status'] === 'accepted'; });
$rejected = array_filter($results, function ($r) {
    return $r['status'] === 'rejected'; });

echo "Summary:\n";
echo "- Total reviewed: " . count($results) . "\n";
echo "- Accepted: " . count($accepted) . "\n";
echo "- Rejected: " . count($rejected) . "\n";
echo "- Output saved to: $output_file\n";

function saveResults($results, $output_file)
{
    $handle = fopen($output_file, 'w');
    if (!$handle) {
        die("Error: Could not open output file for writing\n");
    }

    // Write header
    fputcsv($handle, ['original_prompt', 'edited_prompt', 'status']);

    // Write results
    foreach ($results as $result) {
        fputcsv($handle, [
            $result['original'],
            $result['edited'],
            $result['status']
        ]);
    }

    fclose($handle);
}
?>