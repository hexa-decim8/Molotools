<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * TikTok Content Posting API integration.
 *
 * Publishing is async: TikTok returns a publish_id; the video is processed
 * asynchronously. WP-Cron is used to poll for final status.
 * Requires an approved TikTok developer app with video.publish scope.
 */
class SA_Platform_TikTok extends SA_Platform_Base {

    private string $client_key;
    private string $client_secret;
    private string $redirect_uri;

    public function __construct( string $client_key, string $client_secret, string $redirect_uri ) {
        $this->client_key    = $client_key;
        $this->client_secret = $client_secret;
        $this->redirect_uri  = $redirect_uri;
    }

    public function name(): string       { return 'tiktok'; }
    public function label(): string      { return 'TikTok'; }
    public function char_limit(): int    { return 2200; }
    public function is_configured(): bool { return ! empty( $this->client_key ) && ! empty( $this->client_secret ); }

    public function get_auth_url( string $state ): string {
        $params = http_build_query( [
            'client_key'    => $this->client_key,
            'redirect_uri'  => $this->redirect_uri,
            'state'         => $state,
            'scope'         => 'user.info.basic,video.publish,video.list',
            'response_type' => 'code',
        ] );
        return "https://www.tiktok.com/v2/auth/authorize/?{$params}";
    }

    public function exchange_code( string $code, string $code_verifier = '' ): array {
        $data = $this->post_form(
            'https://open.tiktokapis.com/v2/oauth/token/',
            [
                'client_key'    => $this->client_key,
                'client_secret' => $this->client_secret,
                'code'          => $code,
                'grant_type'    => 'authorization_code',
                'redirect_uri'  => $this->redirect_uri,
            ]
        );

        return [
            'access_token'     => $data['access_token'],
            'refresh_token'    => $data['refresh_token'] ?? null,
            'expires_at'       => isset( $data['expires_in'] )
                ? ( new DateTime() )->modify( '+' . (int) $data['expires_in'] . ' seconds' )
                : null,
            'platform_user_id' => $data['open_id'] ?? null,
            'username'         => null,
            'follower_count'   => 0,
        ];
    }

    public function refresh_token( string $refresh_token ): array {
        $data = $this->post_form(
            'https://open.tiktokapis.com/v2/oauth/token/',
            [
                'client_key'    => $this->client_key,
                'client_secret' => $this->client_secret,
                'refresh_token' => $refresh_token,
                'grant_type'    => 'refresh_token',
            ]
        );

        return [
            'access_token'  => $data['access_token'],
            'refresh_token' => $data['refresh_token'] ?? null,
            'expires_at'    => isset( $data['expires_in'] )
                ? ( new DateTime() )->modify( '+' . (int) $data['expires_in'] . ' seconds' )
                : null,
        ];
    }

    public function publish_post( string $access_token, string $text, array $options = [] ): array {
        if ( empty( $options['media_url'] ) ) {
            throw new RuntimeException( 'TikTok requires a video URL to publish content.' );
        }

        $data = $this->post_json(
            'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/',
            [
                'source_info' => [
                    'source'    => 'PULL_FROM_URL',
                    'video_url' => $options['media_url'],
                ],
                'post_info' => [
                    'title'             => $text,
                    'privacy_level'     => 'PUBLIC_TO_EVERYONE',
                    'disable_duet'      => false,
                    'disable_stitch'    => false,
                    'disable_comment'   => false,
                ],
            ],
            [ 'Authorization' => "Bearer {$access_token}" ]
        );

        return [
            'post_id' => $data['data']['publish_id'] ?? 'pending',
            'url'     => 'https://www.tiktok.com/', // TikTok returns no direct URL immediately
        ];
    }

    public function get_share_url( string $text, string $url = '' ): string {
        if ( $url ) {
            return 'https://www.tiktok.com/share?url=' . rawurlencode( $url )
                . '&text=' . rawurlencode( $text );
        }
        return '';
    }
}
