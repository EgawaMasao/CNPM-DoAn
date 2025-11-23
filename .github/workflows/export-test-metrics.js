// Script to export test results to Prometheus Pushgateway
const { exec } = require('child_process');
const fs = require('fs');
const axios = require('axios');

// Parse test results from Jest/Mocha output
function parseTestResults(testOutput) {
  const metrics = {
    total_tests: 0,
    passed_tests: 0,
    failed_tests: 0,
    skipped_tests: 0,
    test_suites: [],
    failed_test_cases: []
  };

  // Parse Jest JSON output
  try {
    const results = JSON.parse(testOutput);
    
    results.testResults.forEach(suite => {
      const suiteName = suite.name.replace(/.*\//, '');
      const suiteMetric = {
        name: suiteName,
        total: suite.assertionResults.length,
        passed: 0,
        failed: 0,
        skipped: 0
      };

      suite.assertionResults.forEach(test => {
        metrics.total_tests++;
        
        if (test.status === 'passed') {
          metrics.passed_tests++;
          suiteMetric.passed++;
        } else if (test.status === 'failed') {
          metrics.failed_tests++;
          suiteMetric.failed++;
          metrics.failed_test_cases.push({
            suite: suiteName,
            test: test.title,
            error: test.failureMessages.join('\n')
          });
        } else if (test.status === 'skipped') {
          metrics.skipped_tests++;
          suiteMetric.skipped++;
        }
      });

      metrics.test_suites.push(suiteMetric);
    });
  } catch (err) {
    console.error('Error parsing test results:', err.message);
  }

  return metrics;
}

// Convert to Prometheus format
function toPrometheusFormat(metrics, service) {
  let output = '';
  
  // Overall metrics
  output += `# HELP ci_tests_total Total number of tests\n`;
  output += `# TYPE ci_tests_total gauge\n`;
  output += `ci_tests_total{service="${service}"} ${metrics.total_tests}\n\n`;
  
  output += `# HELP ci_tests_passed Number of passed tests\n`;
  output += `# TYPE ci_tests_passed gauge\n`;
  output += `ci_tests_passed{service="${service}"} ${metrics.passed_tests}\n\n`;
  
  output += `# HELP ci_tests_failed Number of failed tests\n`;
  output += `# TYPE ci_tests_failed gauge\n`;
  output += `ci_tests_failed{service="${service}"} ${metrics.failed_tests}\n\n`;
  
  // Per-suite metrics
  metrics.test_suites.forEach(suite => {
    output += `# Test suite: ${suite.name}\n`;
    output += `ci_test_suite_total{service="${service}",suite="${suite.name}"} ${suite.total}\n`;
    output += `ci_test_suite_passed{service="${service}",suite="${suite.name}"} ${suite.passed}\n`;
    output += `ci_test_suite_failed{service="${service}",suite="${suite.name}"} ${suite.failed}\n\n`;
  });
  
  return output;
}

// Main execution
async function exportMetrics(service, testResultFile) {
  try {
    const testOutput = fs.readFileSync(testResultFile, 'utf8');
    const metrics = parseTestResults(testOutput);
    const prometheusMetrics = toPrometheusFormat(metrics, service);
    
    // Print to console for GitHub Actions
    console.log('=== Test Results Summary ===');
    console.log(`Total: ${metrics.total_tests}`);
    console.log(`Passed: ${metrics.passed_tests}`);
    console.log(`Failed: ${metrics.failed_tests}`);
    
    if (metrics.failed_test_cases.length > 0) {
      console.log('\n=== Failed Tests ===');
      metrics.failed_test_cases.forEach(test => {
        console.log(`❌ ${test.suite} > ${test.test}`);
      });
    }
    
    // Push to Prometheus Pushgateway (if available)
    const pushgatewayUrl = process.env.PROMETHEUS_PUSHGATEWAY_URL;
    if (pushgatewayUrl) {
      await axios.post(
        `${pushgatewayUrl}/metrics/job/ci_tests/instance/${service}`,
        prometheusMetrics,
        { headers: { 'Content-Type': 'text/plain' } }
      );
      console.log('\n✅ Metrics pushed to Prometheus');
    }
    
    // Save metrics to file
    fs.writeFileSync(`test-metrics-${service}.txt`, prometheusMetrics);
    
    // Save detailed JSON for Grafana
    fs.writeFileSync(`test-results-${service}.json`, JSON.stringify(metrics, null, 2));
    
  } catch (err) {
    console.error('Error exporting metrics:', err.message);
    process.exit(1);
  }
}

// Run
const service = process.argv[2] || 'unknown';
const testResultFile = process.argv[3] || 'test-results.json';
exportMetrics(service, testResultFile);
