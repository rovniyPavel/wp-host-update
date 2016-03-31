<?php


class ProcessController extends BaseController
{

	/**
	 * Main script to replace strings in tables.
	 * 
	 * All data is inside $_POST:
	 * 		[search_replace] => [
	 * 				[ find, replace ]
	 * 				...
	 * 		],
	 * 		[tables_choice] => all | custom
	 * 		[tables_custom] => [ // all tables which should be updated
	 * 			'wp_commentmeta',
	 * 			'wp_comments',
	 * 			...
	 * 		],
	 * 		[step] => 0, // current index inside tables_custom
	 */
	public function actionIndex()
	{
		global $wpdb;
		$tables = $_POST['tables_custom'];
		$step = $_POST['step'];
		$current_table = $tables[$step];
		$updated_tables = 0;

		$select = "SELECT " . $current_table . ".* FROM " . $current_table;
		$datas = $wpdb->get_results($select);
		$primary_keys = $wpdb->get_results("SHOW KEYS FROM `$current_table` WHERE Key_name = 'PRIMARY'");

		foreach ( $datas as $row ) {
			$update = "UPDATE $current_table SET ";
			$i = 1;

			foreach ( $row as $key => $value ) {
				if ( $primary_keys[0]->Column_name == $key ) {
					$where = " WHERE $key=$value";
					$i++;
					continue;
				}

				if ( strpos($current_table, 'blogs') ) {
					$value = $this->applyReplaces($value, true);
				}
				else {
					$value = $this->recursiveReplace($value);
				}

				$update_values[] =  $key . "='" . $this->sqlAddslashes($value) . "'";
				$i++;
			}
			$update .= implode(',', $update_values);
			$wpdb->query($update . $where);
			$updated_tables++;
		}
		return $this->responseJson(array(
			'updated' => $updated_tables,
		));
	}

	/**
	 * Recursive replace values
	 * @param string|array $data
	 * @param boolean $serialized
	 * @param boolean $parent_serialized
	 * @return string
	 */
	public function recursiveReplace( $data, $serialized = false, $parent_serialized = false )
	{
		$is_json = false;
		if ( is_string($data) && ( $unserialized = unserialize($data) ) !== false ) {
			// PHP currently has a bug that doesn't allow you to clone the DateInterval / DatePeriod classes.
			// We skip them here as they probably won't need data to be replaced anyway
			if ( is_object($unserialized) && ( $unserialized instanceof DateInterval || $unserialized instanceof DatePeriod ) ) {
				return $data;
			}
			$data = $this->recursiveReplace($unserialized, true, true);
		}
		elseif ( is_array($data) ) {
			$_tmp = array();

			foreach ( $data as $key => $value ) {
				$_tmp[$key] = $this->recursiveReplace($value, false, $parent_serialized);
			}
			$data = $_tmp;
			unset($_tmp);
		}
		// Submitted by Tina Matter
		elseif ( is_object($data) ) {
			$_tmp = clone $data;

			foreach ( $data as $key => $value ) {
				$_tmp->$key = $this->recursiveReplace($value, false, $parent_serialized);
			}
			$data = $_tmp;
			unset($_tmp);
		}
		elseif ( $this->isJson($data, true) ) {
			$_tmp = array();
			$data = json_decode($data, true);

			foreach ( $data as $key => $value ) {
				$_tmp[$key] = $this->recursiveReplace($value, false, $parent_serialized);
			}
			$data = $_tmp;
			unset($_tmp);
			$is_json = true;
		}
		elseif ( is_string($data) ) {
			$data = $this->applyReplaces($data);
		}

		if ( $serialized )
			return serialize($data);

		if ( $is_json )
			return json_encode($data);

		return $data;
	}

	/**
	 * Apply replace
	 * @param string $subject
	 * @param boolean $is_serialized
	 * @return boolean
	 */
	public function applyReplaces( $subject, $is_blogs = false )
	{
		$search = !empty($is_blogs) ? $_POST['domain_replace'] : $_POST['search_replace'];

		foreach ( $search as $replace ) {
			$subject = str_ireplace($replace[0], $replace[1], $subject);
		}
		return $subject;
	}

	/**
	 * 
	 * @param string $string
	 * @param boolean $strict
	 * @return boolean
	 */
	public function isJson( $string, $strict = false )
	{
		$json = @json_decode($string, true);

		if ( $strict == true && !is_array($json) )
			return false;

		return !( $json == NULL || $json == false );
	}

	/**
	 * Better addslashes for SQL queries.
	 * Taken from phpMyAdmin.
	 */
	public function sqlAddslashes( $string = '' )
	{
		$string = str_replace('\\', '\\\\', $string);
		return str_replace('\'', '\\\'', $string);
	}

}
