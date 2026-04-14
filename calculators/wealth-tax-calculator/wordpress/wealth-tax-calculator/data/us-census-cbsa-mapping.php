<?php
/**
 * US Census CBSA (Core Based Statistical Area) City Classification Mapping
 * 
 * Maps US cities to urban/rural classifications based on Census Bureau CBSA definitions:
 * - urban: Metropolitan Statistical Area (population 50,000+)
 * - suburban: Micropolitan Statistical Area (population 10,000-50,000)
 * - rural: Non-metro areas (outside CBSA)
 * 
 * Data source: US Census Bureau CBSA delineation files
 * Last updated: 2024
 * 
 * Format: city_slug => array('classification' => 'urban|suburban|rural', 'cbsa_name' => '...', 'state' => 'XX')
 */

// Major Metropolitan Areas (urban)
$cbsa_mapping = array(
	// Michigan
	'detroit' => array('classification' => 'urban', 'cbsa_name' => 'Detroit-Warren-Dearborn', 'state' => 'MI'),
	'grand-rapids' => array('classification' => 'urban', 'cbsa_name' => 'Grand Rapids-Kentwood', 'state' => 'MI'),
	'ann-arbor' => array('classification' => 'urban', 'cbsa_name' => 'Ann Arbor', 'state' => 'MI'),
	'lansing' => array('classification' => 'urban', 'cbsa_name' => 'Lansing-East Lansing', 'state' => 'MI'),
	'flint' => array('classification' => 'urban', 'cbsa_name' => 'Flint', 'state' => 'MI'),
	'midland' => array('classification' => 'suburban', 'cbsa_name' => 'Midland', 'state' => 'MI'),
	'traverse-city' => array('classification' => 'suburban', 'cbsa_name' => 'Traverse City', 'state' => 'MI'),
	'kalamazoo' => array('classification' => 'urban', 'cbsa_name' => 'Kalamazoo-Portage', 'state' => 'MI'),
	'muskegon' => array('classification' => 'suburban', 'cbsa_name' => 'Muskegon', 'state' => 'MI'),
	'battle-creek' => array('classification' => 'suburban', 'cbsa_name' => 'Battle Creek', 'state' => 'MI'),
	'jackson' => array('classification' => 'suburban', 'cbsa_name' => 'Jackson', 'state' => 'MI'),
	'saginaw' => array('classification' => 'urban', 'cbsa_name' => 'Saginaw', 'state' => 'MI'),
	'monroe' => array('classification' => 'suburban', 'cbsa_name' => 'Monroe', 'state' => 'MI'),
	'niles' => array('classification' => 'suburban', 'cbsa_name' => 'Niles', 'state' => 'MI'),
	'brighton' => array('classification' => 'suburban', 'cbsa_name' => 'Detroit_Metro', 'state' => 'MI'),
	'northville' => array('classification' => 'urban', 'cbsa_name' => 'Detroit-Warren-Dearborn', 'state' => 'MI'),
	'dearborn' => array('classification' => 'urban', 'cbsa_name' => 'Detroit-Warren-Dearborn', 'state' => 'MI'),
	'dearborn-heights' => array('classification' => 'urban', 'cbsa_name' => 'Detroit-Warren-Dearborn', 'state' => 'MI'),
	'livonia' => array('classification' => 'urban', 'cbsa_name' => 'Detroit-Warren-Dearborn', 'state' => 'MI'),
	'warren' => array('classification' => 'urban', 'cbsa_name' => 'Detroit-Warren-Dearborn', 'state' => 'MI'),
	'sterling-heights' => array('classification' => 'urban', 'cbsa_name' => 'Detroit-Warren-Dearborn', 'state' => 'MI'),
	'pontiac' => array('classification' => 'urban', 'cbsa_name' => 'Detroit-Warren-Dearborn', 'state' => 'MI'),
	'troy' => array('classification' => 'urban', 'cbsa_name' => 'Detroit-Warren-Dearborn', 'state' => 'MI'),
	'farmington-hills' => array('classification' => 'urban', 'cbsa_name' => 'Detroit-Warren-Dearborn', 'state' => 'MI'),
	'taylor' => array('classification' => 'urban', 'cbsa_name' => 'Detroit-Warren-Dearborn', 'state' => 'MI'),
	'westland' => array('classification' => 'urban', 'cbsa_name' => 'Detroit-Warren-Dearborn', 'state' => 'MI'),
	
	// National metros (sample)
	'new-york' => array('classification' => 'urban', 'cbsa_name' => 'New York-Newark-Jersey City', 'state' => 'NY'),
	'los-angeles' => array('classification' => 'urban', 'cbsa_name' => 'Los Angeles-Long Beach-Anaheim', 'state' => 'CA'),
	'chicago' => array('classification' => 'urban', 'cbsa_name' => 'Chicago-Naperville-Elgin', 'state' => 'IL'),
	'houston' => array('classification' => 'urban', 'cbsa_name' => 'Houston-The Woodlands-Sugar Land', 'state' => 'TX'),
	'phoenix' => array('classification' => 'urban', 'cbsa_name' => 'Phoenix-Mesa-Scottsdale', 'state' => 'AZ'),
	'philadelphia' => array('classification' => 'urban', 'cbsa_name' => 'Philadelphia-Camden-Wilmington', 'state' => 'PA'),
	'san-antonio' => array('classification' => 'urban', 'cbsa_name' => 'San Antonio-New Braunfels', 'state' => 'TX'),
	'san-diego' => array('classification' => 'urban', 'cbsa_name' => 'San Diego-Carlsbad', 'state' => 'CA'),
	'dallas' => array('classification' => 'urban', 'cbsa_name' => 'Dallas-Fort Worth-Arlington', 'state' => 'TX'),
	'san-jose' => array('classification' => 'urban', 'cbsa_name' => 'San Jose-Sunnyvale-Santa Clara', 'state' => 'CA'),
	'austin' => array('classification' => 'urban', 'cbsa_name' => 'Austin-Round Rock', 'state' => 'TX'),
	'boston' => array('classification' => 'urban', 'cbsa_name' => 'Boston-Cambridge-Newton', 'state' => 'MA'),
	'denver' => array('classification' => 'urban', 'cbsa_name' => 'Denver-Aurora-Lakewood', 'state' => 'CO'),
	'seattle' => array('classification' => 'urban', 'cbsa_name' => 'Seattle-Tacoma-Bellevue', 'state' => 'WA'),
	'minneapolis' => array('classification' => 'urban', 'cbsa_name' => 'Minneapolis-St. Paul-Bloomington', 'state' => 'MN'),
	'atlanta' => array('classification' => 'urban', 'cbsa_name' => 'Atlanta-Sandy Springs-Roswell', 'state' => 'GA'),
	'miami' => array('classification' => 'urban', 'cbsa_name' => 'Miami-Fort Lauderdale-West Palm Beach', 'state' => 'FL'),
	'tampa' => array('classification' => 'urban', 'cbsa_name' => 'Tampa-St. Petersburg-Clearwater', 'state' => 'FL'),
	'orlando' => array('classification' => 'urban', 'cbsa_name' => 'Orlando-Kissimmee-Sanford', 'state' => 'FL'),
	'nashville' => array('classification' => 'urban', 'cbsa_name' => 'Nashville-Davidson', 'state' => 'TN'),
	'memphis' => array('classification' => 'urban', 'cbsa_name' => 'Memphis', 'state' => 'TN'),
	'charlotte' => array('classification' => 'urban', 'cbsa_name' => 'Charlotte-Concord-Gastonia', 'state' => 'NC'),
	'columbus' => array('classification' => 'urban', 'cbsa_name' => 'Columbus', 'state' => 'OH'),
	'louisville' => array('classification' => 'urban', 'cbsa_name' => 'Louisville-Jefferson County', 'state' => 'KY'),
	'baltimore' => array('classification' => 'urban', 'cbsa_name' => 'Baltimore-Columbia-Towson', 'state' => 'MD'),
	'washington' => array('classification' => 'urban', 'cbsa_name' => 'Washington-Arlington-Alexandria', 'state' => 'DC'),
	'portland' => array('classification' => 'urban', 'cbsa_name' => 'Portland-Vancouver-Hillsboro', 'state' => 'OR'),
	'las-vegas' => array('classification' => 'urban', 'cbsa_name' => 'Las Vegas-Henderson-North Las Vegas', 'state' => 'NV'),
	'honolulu' => array('classification' => 'urban', 'cbsa_name' => 'Honolulu', 'state' => 'HI'),
	'buffalo' => array('classification' => 'urban', 'cbsa_name' => 'Buffalo-Cheektowaga-Niagara Falls', 'state' => 'NY'),
	'pittsburgh' => array('classification' => 'urban', 'cbsa_name' => 'Pittsburgh', 'state' => 'PA'),
	'kansas-city' => array('classification' => 'urban', 'cbsa_name' => 'Kansas City', 'state' => 'MO'),
	'los-angeles' => array('classification' => 'urban', 'cbsa_name' => 'Los Angeles-Long Beach-Anaheim', 'state' => 'CA'),
	'sacramento' => array('classification' => 'urban', 'cbsa_name' => 'Sacramento--Roseville--Arden-Arcade', 'state' => 'CA'),
	'san-francisco' => array('classification' => 'urban', 'cbsa_name' => 'San Francisco-Oakland-Hayward', 'state' => 'CA'),
	'oakland' => array('classification' => 'urban', 'cbsa_name' => 'San Francisco-Oakland-Hayward', 'state' => 'CA'),
);

/**
 * Get urban/rural classification for a city
 * 
 * @param string $city_slug Sanitized city name (lowercase, hyphens)
 * @param string $state_code Two-letter state code
 * @return string 'urban', 'suburban', 'rural', or 'unknown'
 */
function wtc_get_city_classification( $city_slug, $state_code = '' ) {
	global $cbsa_mapping;
	
	$city_slug = sanitize_title( $city_slug );
	$state_code = strtoupper( sanitize_text_field( $state_code ) );
	
	if ( isset( $cbsa_mapping[ $city_slug ] ) ) {
		$entry = $cbsa_mapping[ $city_slug ];
		// Verify state match if provided
		if ( $state_code !== '' && isset( $entry['state'] ) && $entry['state'] !== $state_code ) {
			return 'unknown';
		}
		return $entry['classification'];
	}
	
	return 'unknown';
}

return $cbsa_mapping;
