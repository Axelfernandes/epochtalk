var fs = require('fs');
var _ = require('lodash');

module.exports = ['$state', function($state) {
  return {
    restrict: 'E',
    template: fs.readFileSync(__dirname + '/category-editor.html'),
    controller: function($scope) {
      $scope.catListId = 'categorized-boards';
      $scope.boardListId = 'uncategorized-boards';
      $scope.catListOpts = { protectRoot: true, maxDepth: 5, group: 1 };
      $scope.boardListOpts = { protectRoot: true, maxDepth: 4, group: 1 };
      var dataId = 0;

      var deleteDataId = ''; // Stores the data-id of item being deleted

      var editCatDataId = ''; // Stores the data-id of category being edited
      $scope.editCatName = ''; // Model for edited category name

      var editBoardDataId = ''; // Stores the data-id of board being edited
      var editBoardId = ''; // Stores the id of the board being edited
      $scope.editBoardName = ''; // Model for edited board name
      $scope.editBoardDesc = ''; // Model for edited board desc

      $scope.getDataId = function() { return dataId++; };

      $scope.setEditCat = function(dataId) {
        var editCat = $scope.nestableMap[dataId];
        editCatDataId = dataId;
        $scope.editCatName = editCat.name;
      };

      // Edits the set category
      $scope.editCategory = function() {
        var editCatEl = $('li[data-id="' + editCatDataId + '"]');
        // Update UI to reflect change
        var catDescEl = editCatEl.children('.dd-handle').children('.dd-desc');
        catDescEl.text($scope.editCatName);
        // Show that the item was changed
        var status = editCatEl.children('.dd-handle').children('.status');
        status.addClass('modified');

        // Update the category name
        var editCatData = editCatEl.data();
        editCatData.name = $scope.editCatName;
        var editCat = $scope.nestableMap[editCatDataId];
        editCat.name = $scope.editCatName;

        // Reset and close
        $scope.editCatName = '';
        editCatDataId = '';
        $scope.closeModal('#edit-category');
      };

      $scope.setEditBoard = function(dataId) {
        var editBoard = $scope.nestableMap[dataId];
        editBoardDataId = dataId;
        editBoardId = editBoard.id;
        $scope.editBoardName = editBoard.name;
        $scope.editBoardDesc = editBoard.description;
      };

      // Edits the set board
      $scope.editBoard = function() {
        // Board being edited is in new board array
        if (editBoardId === -1 && editBoardDataId) {
          $scope.newBoards.forEach(function(newBoard) {
            if (newBoard.dataId === editBoardDataId) {
              newBoard.name = $scope.editBoardName;
              newBoard.description = $scope.editBoardDesc;
            }
          });
        }
        // Board being edited is an existing board
        else {
          var editedBoard = {
            name: $scope.editBoardName,
            description: $scope.editBoardDesc
          };
         $scope.editedBoards[editBoardId] = editedBoard;
        }

        var editBoardEl = $('li[data-id="' + editBoardDataId + '"]');
        var status = editBoardEl.children('.dd-handle').children('.status');
        status.addClass('modified');

        // Update UI to reflect change
        var boardDescEl = editBoardEl.children('.dd-handle').children('.dd-desc');
        boardDescEl.text($scope.editBoardName);

        // Update data stored in nestableMap to reflect edit
        var board = $scope.nestableMap[editBoardDataId];
        board.name = $scope.editBoardName;
        board.description = $scope.editBoardDesc;

        // Reset scope params for editing board
        editBoardDataId = '';
        editBoardId = '';
        $scope.editBoardName = '';
        $scope.editBoardDesc = '';
        $scope.closeModal('#edit-board');
      };

      $scope.setDelete = function(dataId) { deleteDataId = dataId; };

      $scope.confirmDelete = function() {
        var deleteEl = $('li[data-id="' + deleteDataId + '"]');
        if (deleteEl) {
          var boardListEl = $('#' + $scope.boardListId + ' > .dd-list');
          var childBoardsHtml = deleteEl.children('.dd-list').html();
          boardListEl.append(childBoardsHtml);
          deleteEl.remove();
        }

        deleteDataId = '';
        $scope.closeModal('#delete-confirm');
      };

      $scope.closeModal = function(modalId) {
        $(modalId).foundation('reveal', 'close');
      };

      // Expands all Categories/Boards
      $scope.expandAll = function() {
        $('#' + $scope.catListId).nestable('expandAll');
      };

      // Collapses all Categories/Boards
      $scope.collapseAll = function() {
        $('#' + $scope.catListId).nestable('collapseAll');
      };

      $scope.reset = function() {
        $state.go($state.$current, null, { reload: true });
      };

      $scope.save = function() {
        var serializedCats = $('#' + $scope.catListId).nestable('serialize');
        // 0) Create new Categories
        return $scope.processNewCategories()
        // 1) Create new boards
        .then($scope.processNewBoards)
        // 2) Handle Boards which have been edited
        .then($scope.processEditedBoards)
        // 3) Updated all Categories
        .then(function() {
          buildUpdatedCats(serializedCats);
          return $scope.processCategories();
        })
        .then(function() {
          console.log('Done Saving!');
          return $state.go($state.$current, null, { reload: true });
        });
      };

      // Translates serialized array into boards.updateCategory format
      var buildUpdatedCats = function(catsArr) {
        $scope.boardMapping = [];
        catsArr.forEach(function(cat, index) {
          // add this cat as a row entry
          var catId = $scope.nestableMap[cat.id].id;
          var row = { type: 'category', id: catId, name: cat.name, view_order: index };
          $scope.boardMapping.push(row);

          // add children boards as entries recursively
          if (!cat.children) { return; }
          cat.children.forEach(function(catBoard, index) {
            // add this cat board as a row entry
            var boardId = $scope.nestableMap[catBoard.id].id;
            var boardRow = {
              type: 'board',
              id: boardId,
              category_id: catId,
              view_order: index
            };
            $scope.boardMapping.push(boardRow);

            // add any children board entries
            if (catBoard.children && catBoard.children.length > 0) {
              buildEntries(catBoard.children, boardId);
            }
          });
        });
      };

      function buildEntries(currentBoards, parentId) {
        currentBoards.forEach(function(board, index) {
          // add this board as a row entry
          var boardId = $scope.nestableMap[board.id].id;
          var row = { type: 'board', id: boardId, parent_id: parentId, view_order: index };
          $scope.boardMapping.push(row);

          // add any children boards as a row entry
          if (board.children && board.children.length > 0) {
            buildEntries(board.children, boardId);
          }
        });
      }
    }
  };
}];
