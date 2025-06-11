<script>
	export let id = undefined;
</script>

<header>
	<h1>Issues {id}</h1>
	<slot></slot>
</header>

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 32px;
	}
</style>
