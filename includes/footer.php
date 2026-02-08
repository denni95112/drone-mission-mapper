<?php
$footerBasePath = (strpos($_SERVER['PHP_SELF'], '/updater/') !== false) ? '../' : '';
?>
<footer>
    <p>MIT License - Erstellt von <a href="https://github.com/denni95112">Dennis Bögner</a></p>
    <p>Version <?php echo defined('APP_VERSION') ? APP_VERSION : ''; ?> - <a href="<?php echo $footerBasePath; ?>changelog.php">Changelog</a></p>
    <p><a href="https://open-drone-tools.de/">open-drone-tools.de</a></p>
    <?php if (function_exists('isAuthenticated') && isAuthenticated()) { include __DIR__ . '/buy_me_a_coffee.php'; } ?>
</footer>

<script src="js/modules/update-checker.js"></script>
<script>
    if (typeof UpdateChecker !== 'undefined') {
        window.updateChecker = new UpdateChecker();
    }
</script>

