<?php
/**
 * Alternative script to import prompts from a CSV file
 * Use this if you prefer to export user_message data from MySQL to CSV first
 * 
 * To export from MySQL, run this query:
 * SELECT DISTINCT user_message FROM feedback WHERE user_message IS NOT NULL AND user_message != '' INTO OUTFILE '/tmp/prompts.csv' FIELDS TERMINATED BY ',' ENCLOSED BY '"' LINES TERMINATED BY '\n';
 */

// Path to the CSV file containing the exported prompts
$csv_file = __DIR__ . '/onoprompts.csv';
$prompts_file = __DIR__ . '/prompts.json';

try {
    // Check if CSV file exists
    if (!file_exists($csv_file)) {
        die("Error: CSV file not found at: $csv_file\n");
    }
    
    // Read existing prompts.json file
    if (!file_exists($prompts_file)) {
        die("Error: prompts.json file not found at: $prompts_file\n");
    }
    
    $existing_data = json_decode(file_get_contents($prompts_file), true);
    if ($existing_data === null) {
        die("Error: Could not parse existing prompts.json file\n");
    }
    
    $existing_prompts = $existing_data['prompts'] ?? [];
    echo "Found " . count($existing_prompts) . " existing prompts.\n";
    
    // Read CSV file - handle different CSV formats
    $csv_prompts = [];
    if (($handle = fopen($csv_file, 'r')) !== FALSE) {
        while (($data = fgetcsv($handle, 1000, ',', '"', '\\')) !== FALSE) {
            // Handle different CSV formats - check all columns for prompts
            foreach ($data as $field) {
                $trimmed = trim($field);
                if (!empty($trimmed) && 
                    !preg_match('/^\d+$/', $trimmed) && // Skip pure numbers
                    !preg_match('/^[a-f0-9]+$/', $trimmed) && // Skip hex IDs
                    strlen($trimmed) > 2) {
                    $csv_prompts[] = $trimmed;
                }
            }
        }
        fclose($handle);
    }
    
    echo "Found " . count($csv_prompts) . " prompts in CSV file.\n";
    
    // Clean and filter CSV prompts
    $cleaned_csv_prompts = [];
    foreach ($csv_prompts as $prompt) {
        $cleaned = trim($prompt);
        
        // Skip if empty, too short, or too long
        if (strlen($cleaned) < 3 || strlen($cleaned) > 200) {
            continue;
        }
        
        // Filter out single word prompts (no spaces)
        if (strpos($cleaned, ' ') === false) {
            echo "Skipping single word: '$cleaned'\n";
            continue;
        }
        
        // Convert to lowercase for deduplication
        $cleaned_lower = strtolower($cleaned);
        
        // Skip if it's already in our cleaned list (exact duplicate, case insensitive)
        $already_exists = false;
        foreach ($cleaned_csv_prompts as $existing) {
            if (strtolower($existing) === $cleaned_lower) {
                $already_exists = true;
                break;
            }
        }
        
        if (!$already_exists) {
            $cleaned_csv_prompts[] = $cleaned;
        } else {
            echo "Skipping duplicate: '$cleaned'\n";
        }
    }
    
    echo "After cleaning: " . count($cleaned_csv_prompts) . " prompts from CSV.\n";
    
    // Merge with existing prompts (avoid duplicates, case insensitive)
    $all_prompts = $existing_prompts;
    $existing_lower = array_map('strtolower', $existing_prompts);
    
    $added_count = 0;
    foreach ($cleaned_csv_prompts as $new_prompt) {
        $new_prompt_lower = strtolower($new_prompt);
        
        // Check if this prompt already exists (case insensitive)
        if (!in_array($new_prompt_lower, $existing_lower)) {
            $all_prompts[] = $new_prompt;
            $existing_lower[] = $new_prompt_lower;
            $added_count++;
        }
    }
    
    echo "Added $added_count new prompts.\n";
    echo "Total prompts: " . count($all_prompts) . "\n";
    
    // Sort prompts alphabetically
    sort($all_prompts, SORT_STRING | SORT_FLAG_CASE);
    
    // Prepare new JSON data
    $new_data = [
        'prompts' => $all_prompts
    ];
    
    // Create backup of original file
    $backup_file = $prompts_file . '.backup.' . date('Y-m-d_H-i-s');
    if (!copy($prompts_file, $backup_file)) {
        die("Error: Could not create backup file\n");
    }
    echo "Created backup: $backup_file\n";
    
    // Write updated prompts.json
    $json_output = json_encode($new_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if (file_put_contents($prompts_file, $json_output) === false) {
        die("Error: Could not write to prompts.json file\n");
    }
    
    echo "Successfully updated prompts.json!\n";
    echo "Final prompt count: " . count($all_prompts) . "\n";
    
    // Show sample of new prompts added
    if ($added_count > 0) {
        echo "\nSample of new prompts added:\n";
        $sample_count = min(10, $added_count);
        $new_prompts_only = array_slice($all_prompts, count($existing_prompts), $sample_count);
        foreach ($new_prompts_only as $i => $prompt) {
            echo "  " . ($i + 1) . ". $prompt\n";
        }
        if ($added_count > $sample_count) {
            echo "  ... and " . ($added_count - $sample_count) . " more\n";
        }
    }
    
} catch (Exception $e) {
    die("Error: " . $e->getMessage() . "\n");
}
?>