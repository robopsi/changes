define([
  'app',
  'utils/chartHelpers',
  'utils/duration',
  'utils/escapeHtml',
  'utils/parseLinkHeader',
  'utils/sortBuildList'
], function(app, chartHelpers, duration, escapeHtml, parseLinkHeader, sortBuildList) {
  'use strict';

  return {
    parent: 'project_details',
    url: 'commits/',
    templateUrl: 'partials/project-commit-list.html',
    controller: function($scope, $state, Collection, commitList, stream) {
      var chart_options = {
        linkFormatter: function(item) {
          if (item.build) {
            return $state.href('build_details', {build_id: item.build.id});
          }
        },
        className: function(item) {
          if (item.build) {
            return 'result-' + item.build.result.id;
          } else {
            return 'result-unknown';
          }
        },
        value: function(item) {
          if (item.build) {
            if ($scope.selectedChart == 'test_count') {
              return item.build.stats.test_count;
            } else if ($scope.selectedChart == 'duration') {
              return item.build.duration;
            } else if ($scope.selectedChart == 'test_duration') {
              return item.build.stats.test_duration / item.build.stats.test_count;
            } else if ($scope.selectedChart == 'test_rerun_count') {
              return item.build.stats.test_rerun_count;
            } else if ($scope.selectedChart == 'tests_missing') {
              return item.build.stats.tests_missing;
            }
          } else {
            return 0;
          }
        },
        tooltipFormatter: function(item) {
          var content = '';

          content += '<h5>';
          content += escapeHtml(item.subject);
          content += '<br><small>';
          content += escapeHtml(item.id.substr(0, 12));
          if (item.author) {
            content += ' &mdash; ' + item.author.name;
          }
          content += '</small>';
          content += '</h5>';

          if (item.build) {
            if ($scope.selectedChart == 'test_count') {
              content += '<p>' + (item.build.stats.test_count || 0) + ' tests recorded';
            } else if ($scope.selectedChart == 'test_duration') {
              content += '<p>' + parseInt(item.build.stats.test_duration / item.build.stats.test_count || 0, 10) + 'ms avg test duration';
            } else if ($scope.selectedChart == 'duration') {
              content += '<p>' + duration(item.build.duration) + ' build time';
            } else if ($scope.selectedChart == 'test_rerun_count') {
              content += '<p>' + (item.build.stats.test_rerun_count || 0) + ' total retries';
            } else if ($scope.selectedChart == 'tests_missing') {
              content += '<p>' + (item.build.stats.tests_missing || 0) + ' job steps missing tests';
            }
          }

          return content;
        }
      };

      function fromCommits(commitList) {
        return commitList.map(function(commit){
          if (commit.message) {
            commit.subject = commit.message.split('\n')[0].substr(0, 128);
          } else if (commit.build) {
            commit.subject = commit.build.label;
          } else {
            commit.subject = 'A homeless commit';
          }
          return commit;
        });
      }

      $scope.commits = new Collection($scope, fromCommits(commitList.data), {
        equals: function(item, other) {
          return item.repository_id == other.repository_id && item.sha == other.sha;
        }
      });

      $scope.selectChart = function(chart) {
        $scope.selectedChart = chart;
        $scope.chartData = chartHelpers.getChartData($scope.commits, null, chart_options);
      };
      $scope.selectChart('duration');

      $scope.$watchCollection("commits", function() {
        $scope.chartData = chartHelpers.getChartData($scope.commits, null, chart_options);
      });

      stream.addScopedChannels($scope, [
        'projects:' + $scope.project.id + ':builds',
        'projects:' + $scope.project.id + ':commits'
      ]);
      stream.addScopedSubscriber($scope, 'build.update', function(data){
        if (data.project.id != $scope.project.id) {
          return;
        }

        var existing = $scope.commits.indexOf(data.source.revision);
        if (existing === -1) {
          return;
        }

        var commit = $scope.commits[existing];
        if (!commit.build) {
          commit.build = data;
        } else if (commit.build.dateCreated >= data.dateCreated) {
          angular.extend(commit.build, data);
        }
      });
      stream.addScopedSubscriber($scope, 'commit.update', function(data){
        if (data.repository.id != $scope.project.repository.id) {
          return;
        }

        $scope.commits.updateItem(data);
      });
    },
    resolve: {
      commitList: function($http, projectData) {
        return $http.get('/api/0/projects/' + projectData.id + '/commits/');
      }
    }
  };
});
